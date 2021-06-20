import supertest from 'supertest'
import crypto from 'crypto'
import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { Customer, Prisma, PrismaClient, Reservation, User } from '@prisma/client'
import { applyMiddleware } from 'src/apply-middleware'
import clearAllData from 'test/setup/clear-all-data'
import jwt from 'jsonwebtoken'
import { JwtPayload } from '@auth/services/access-token/dto/jwt-payload.interface'
import { ReservationModule } from 'src/modules/reservation/reservation.module'
import { advanceTo } from 'jest-date-mock'
import { TimesAvailabilityService } from '@reservation/services/times-availability/times-availability.service'
import { TextUtils } from '@common/utils/text-utils'
import { mocked } from 'ts-jest/utils'
import { PrismaService } from '@common/services/prisma.service'
import { CreateReservationService } from '@reservation/services/create-reservation/create-reservation.service'

describe('CreateRecurringReservation Integration', () => {
  let app: INestApplication
  let request: supertest.SuperTest<supertest.Test>
  let prisma: PrismaClient
  let config: ConfigService
  let prismaService: PrismaService

  let user: User
  let customer: Customer
  let accessToken: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ReservationModule] }).compile()
    app = moduleRef.createNestApplication()
    applyMiddleware(app)
    await app.init()

    request = supertest(app.getHttpServer())

    prisma = new PrismaClient()
    config = moduleRef.get(ConfigService)
    prismaService = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await clearAllData()

    advanceTo('2021-05-03 10:00:00')

    user = await prisma.user.create({
      data: {
        email: 'foo@bar.com',
        password: crypto.randomBytes(20).toString('hex'),
        isEmailConfirmed: true,
      },
    })

    customer = await prisma.customer.create({
      data: { userId: user.id, name: 'Foo Bar' },
    })

    accessToken = jwt.sign(
      { userId: user.id, email: user.email, customerId: customer.id, customerRole: customer.role } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )

    jest.spyOn(TimesAvailabilityService.prototype, 'isRecurringTimeAvailable')
    jest.spyOn(CreateReservationService.prototype, 'createRecurringReservation')
    jest.spyOn(prismaService, '$transaction')
    jest.spyOn(prismaService.reservation, 'createMany')

    jest.clearAllMocks()
  })

  it(`should create a recurring reservation with given properties`, async () => {
    const query = `mutation {
      createRecurringReservation(
        name: "Valid Reservation",
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 14:00')}",
        recurrence: MONTHLY,
        timePeriod: CURRENT_YEAR,
        locations: { tableTennis: true }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.createRecurringReservation.count).toBe(8)
    expect(res.body.data.createRecurringReservation.recurringId).toBeTruthy()
  })

  it(`should call the 'IsRecurringTimeAvailable' use case once`, async () => {
    const query = `mutation {
      createRecurringReservation (
        name: "Valid Reservation",
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 14:00')}",
        recurrence: MONTHLY,
        timePeriod: CURRENT_YEAR,
        locations: { tableTennis: true }
      ) {
        count
        recurringId
      }
    }`

    await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(TimesAvailabilityService.prototype.isRecurringTimeAvailable).toHaveBeenCalledTimes(1)
  })

  it(`should throw an error if the 'IsRecurringTimeAvailable' use case fails`, async () => {
    mocked(TimesAvailabilityService.prototype.isRecurringTimeAvailable).mockRejectedValueOnce(new Error())
    const query = `mutation {
      createRecurringReservation (
        name: "Valid Reservation",
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 14:00')}",
        recurrence: MONTHLY,
        timePeriod: CURRENT_YEAR,
        locations: { tableTennis: true }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBeTruthy()
    expect(TimesAvailabilityService.prototype.isRecurringTimeAvailable).toHaveBeenCalledTimes(1)
    expect(prismaService.reservation.createMany).not.toHaveBeenCalled()
  })

  it('should persist the created reservations to the DB', async () => {
    const startTime = new Date('2021-05-04 12:00')
    const query = `mutation {
      createRecurringReservation (
        name: "Valid Reservation",
        startTime: "${startTime}",
        endTime: "${new Date('2021-05-04 14:00')}",
        recurrence: MONTHLY,
        timePeriod: CURRENT_YEAR,
        locations: { tableTennis: true }
      ) {
        count
        recurringId
      }
    }`

    await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    const reservations = await prisma.reservation.findMany()
    expect(reservations.length).toBe(8)
    const reservationStartTimes = reservations.map((reservation) => reservation.startTime)
    const dates = [...Array(8).keys()].map((_, index) => {
      const date = new Date(startTime)
      date.setMonth(startTime.getMonth() + index)
      return date
    })
    expect(reservationStartTimes).toIncludeAllMembers(dates)
    expect(reservations).toSatisfyAll((reservation: Reservation) => reservation.name === 'Valid Reservation')
  })

  it('should only make one call to the DB to persist the created reservation', async () => {
    const query = `mutation {
      createRecurringReservation (
        name: "Valid Reservation",
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 14:00')}",
        recurrence: MONTHLY,
        timePeriod: CURRENT_YEAR,
        locations: { tableTennis: true }
      ) {
        count
        recurringId
      }
    }`

    await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(prismaService.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaService.reservation.createMany).toHaveBeenCalledTimes(1)
  })

  it(`should assign the same 'recurringId' to all created reservations in the DB`, async () => {
    const query = `mutation {
      createRecurringReservation (
        name: "Valid Reservation",
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 14:00')}",
        recurrence: MONTHLY,
        timePeriod: CURRENT_YEAR,
        locations: { tableTennis: true }
      ) {
        count
        recurringId
      }
    }`

    await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    const reservations = await prisma.reservation.findMany()
    expect(reservations[0].recurringId).toBeTruthy()
    const { recurringId } = reservations[0]
    expect(reservations).toSatisfyAll((reservation: Reservation) => reservation.recurringId === recurringId)
  })

  it(`should create a recurring reservation for multiple locations`, async () => {
    const query = `mutation {
      createRecurringReservation (
        name: "Valid Reservation",
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 14:00')}",
        recurrence: WEEKLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true, badminton: true }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.createRecurringReservation.count).toBe(27)
    expect(res.body.data.createRecurringReservation.recurringId).toBeTruthy()
  })

  it('should persist the multi-location reservation to the DB', async () => {
    const startTime = new Date('2021-05-04 12:00')
    const query = `mutation {
      createRecurringReservation (
        name: "Valid Reservation",
        startTime: "${startTime}",
        endTime: "${new Date('2021-05-04 14:00')}",
        recurrence: WEEKLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true, badminton: true }
      ) {
        count
      }
    }`

    await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    const reservations = await prisma.reservation.findMany()
    expect(reservations.length).toBe(27)
    const reservationStartTimes = reservations.map((reservation) => reservation.startTime)
    const dates = [...Array(27).keys()].map((_, index) => {
      const date = new Date(startTime)
      date.setDate(date.getDate() + index * 7)
      return date
    })
    expect(reservationStartTimes).toIncludeAllMembers(dates)
    expect(reservations).toSatisfyAll((reservation: Reservation) => reservation.name === 'Valid Reservation')
    expect(reservations).toSatisfyAll((reservation: Reservation) => reservation.badminton === true)
    expect(reservations).toSatisfyAll((reservation: Reservation) => reservation.tableTennis === true)
  })

  it('should throw a NotAuthenticated if no access token is provided', async () => {
    const query = `mutation {
      createRecurringReservation (
        name: "Valid Reservation",
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 14:00')}",
        recurrence: WEEKLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true, badminton: true }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('NOT_AUTHENTICATED')
    expect(CreateReservationService.prototype.createRecurringReservation).not.toHaveBeenCalled()
    expect(prismaService.reservation.createMany).not.toHaveBeenCalled()
    const numOfReservations = await prisma.reservation.count()
    expect(numOfReservations).toBe(0)
  })

  it(`should throw a ValidationError if the 'name' is shorter than the minimum length`, async () => {
    const name = crypto.randomBytes(2).toString('hex').slice(0, 2)
    const query = `mutation {
      createRecurringReservation (
        name: "${name}",
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 14:00')}",
        recurrence: WEEKLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true, badminton: true }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(CreateReservationService.prototype.createRecurringReservation).not.toHaveBeenCalled()
    expect(prismaService.reservation.createMany).not.toHaveBeenCalled()
    const numOfReservations = await prisma.reservation.count()
    expect(numOfReservations).toBe(0)
  })

  it(`should throw a ValidationError if the 'name' is longer than the maximum length`, async () => {
    const name = crypto.randomBytes(41).toString('hex')
    const query = `mutation {
      createRecurringReservation (
        name: "${name}",
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 14:00')}",
        recurrence: WEEKLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true, badminton: true }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(CreateReservationService.prototype.createRecurringReservation).not.toHaveBeenCalled()
    expect(prismaService.reservation.createMany).not.toHaveBeenCalled()
    const numOfReservations = await prisma.reservation.count()
    expect(numOfReservations).toBe(0)
  })

  it('should throw a ValidationError if the reservation starts in the past', async () => {
    const query = `mutation {
      createRecurringReservation (
        name: "Past Reservation",
        startTime: "${new Date('2021-05-02 12:00')}",
        endTime: "${new Date('2021-05-02 14:00')}",
        recurrence: WEEKLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(CreateReservationService.prototype.createRecurringReservation).not.toHaveBeenCalled()
    expect(prismaService.reservation.createMany).not.toHaveBeenCalled()
    const numOfReservations = await prisma.reservation.count()
    expect(numOfReservations).toBe(0)
  })

  it('should throw a ValidationError if the reservation length is less than the minimum allowed', async () => {
    const query = `mutation {
      createRecurringReservation (
        name: "Past Reservation",
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 12:20')}",
        recurrence: WEEKLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(CreateReservationService.prototype.createRecurringReservation).not.toHaveBeenCalled()
    expect(prismaService.reservation.createMany).not.toHaveBeenCalled()
    const numOfReservations = await prisma.reservation.count()
    expect(numOfReservations).toBe(0)
  })

  it('should throw a ValidationError if the reservation length exceeds the maximum allowed', async () => {
    const query = `mutation {
      createRecurringReservation (
        name: "Past Reservation",
        startTime: "${new Date('2021-05-04 10:00')}",
        endTime: "${new Date('2021-05-04 16:20')}",
        recurrence: WEEKLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(CreateReservationService.prototype.createRecurringReservation).not.toHaveBeenCalled()
    expect(prismaService.reservation.createMany).not.toHaveBeenCalled()
    const numOfReservations = await prisma.reservation.count()
    expect(numOfReservations).toBe(0)
  })

  it(`should throw a ValidationError if 'startTime' is later in time than 'endTime'`, async () => {
    const query = `mutation {
      createRecurringReservation (
        name: "Past Reservation",
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 11:20')}",
        recurrence: WEEKLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(CreateReservationService.prototype.createRecurringReservation).not.toHaveBeenCalled()
    expect(prismaService.reservation.createMany).not.toHaveBeenCalled()
    const numOfReservations = await prisma.reservation.count()
    expect(numOfReservations).toBe(0)
  })

  it('should throw a ValidationError if both locations are false', async () => {
    const query = `mutation {
      createRecurringReservation (
        name: "Past Reservation",
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 13:20')}",
        recurrence: WEEKLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: false, badminton: false }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(CreateReservationService.prototype.createRecurringReservation).not.toHaveBeenCalled()
    expect(prismaService.reservation.createMany).not.toHaveBeenCalled()
    const numOfReservations = await prisma.reservation.count()
    expect(numOfReservations).toBe(0)
  })

  it(`should throw a ValidationError if 'locations' is an empty object`, async () => {
    const query = `mutation {
      createRecurringReservation (
        name: "Past Reservation",
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 13:20')}",
        recurrence: WEEKLY,
        timePeriod: HALF_YEAR,
        locations: { }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(CreateReservationService.prototype.createRecurringReservation).not.toHaveBeenCalled()
    expect(prismaService.reservation.createMany).not.toHaveBeenCalled()
    const numOfReservations = await prisma.reservation.count()
    expect(numOfReservations).toBe(0)
  })

  it(`should throw a GraphQL validation error if the 'name' argument is not specified`, async () => {
    const query = `mutation {
      createRecurringReservation (
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 13:20')}",
        recurrence: WEEKLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: false, badminton: false }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    expect(CreateReservationService.prototype.createRecurringReservation).not.toHaveBeenCalled()
    expect(prismaService.reservation.createMany).not.toHaveBeenCalled()
    const numOfReservations = await prisma.reservation.count()
    expect(numOfReservations).toBe(0)
  })

  it(`should throw a GraphQL validation error if the 'startTime' argument is not specified`, async () => {
    const query = `mutation {
      createRecurringReservation (
        name: "Invalid Reservation",
        endTime: "${new Date('2021-05-04 13:20')}",
        recurrence: WEEKLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: false, badminton: false }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    expect(CreateReservationService.prototype.createRecurringReservation).not.toHaveBeenCalled()
    expect(prismaService.reservation.createMany).not.toHaveBeenCalled()
    const numOfReservations = await prisma.reservation.count()
    expect(numOfReservations).toBe(0)
  })

  it(`should throw a GraphQL validation error if the 'endTime' argument is not specified`, async () => {
    const query = `mutation {
      createRecurringReservation (
        name: "Invalid Reservation",
        startTime: "${new Date('2021-05-04 13:20')}",
        recurrence: WEEKLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: false, badminton: false }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    expect(CreateReservationService.prototype.createRecurringReservation).not.toHaveBeenCalled()
    expect(prismaService.reservation.createMany).not.toHaveBeenCalled()
    const numOfReservations = await prisma.reservation.count()
    expect(numOfReservations).toBe(0)
  })

  it(`should throw a GraphQL validation error if the 'locations' argument is not specified`, async () => {
    const query = `mutation {
      createRecurringReservation (
        name: "Invalid Reservation",
        startTime: "${new Date('2021-05-04 12:20')}",
        endTime: "${new Date('2021-05-04 13:20')}",
        recurrence: WEEKLY,
        timePeriod: HALF_YEAR,
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    expect(CreateReservationService.prototype.createRecurringReservation).not.toHaveBeenCalled()
    expect(prismaService.reservation.createMany).not.toHaveBeenCalled()
    const numOfReservations = await prisma.reservation.count()
    expect(numOfReservations).toBe(0)
  })

  it(`should use the 'HalfYear' value if no 'timePeriod' argument is specified`, async () => {
    const query = `mutation {
      createRecurringReservation (
        name: "Valid Reservation",
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 14:00')}",
        recurrence: MONTHLY,
        locations: { tableTennis: true }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.createRecurringReservation.count).toBe(6)
    expect(res.body.data.createRecurringReservation.recurringId).toBeTruthy()
  })

  it(`should use the 'Weekly' value if no 'recurrence' argument is specified`, async () => {
    const query = `mutation {
      createRecurringReservation (
        name: "Valid Reservation",
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 14:00')}",
        timePeriod: CURRENT_YEAR, 
        locations: { tableTennis: true }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.createRecurringReservation.count).toBe(35)
    expect(res.body.data.createRecurringReservation.recurringId).toBeTruthy()
  })

  it('should throw a TimeNotAvailable if at least one of the dates is not available', async () => {
    mocked(TimesAvailabilityService.prototype.isRecurringTimeAvailable).mockResolvedValueOnce({
      availableTimes: [new Date()],
      unavailableTimes: [new Date('2021-05-04 13:00')],
    })
    const query = `mutation {
      createRecurringReservation (
        name: "Valid Reservation",
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 14:00')}",
        timePeriod: CURRENT_YEAR,
        recurrence: WEEKLY,
        locations: { tableTennis: true }
      ) {
        count
        recurringId
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('TIME_NOT_AVAILABLE')
    expect(CreateReservationService.prototype.createRecurringReservation).toHaveBeenCalledTimes(1)
    expect(prismaService.reservation.createMany).not.toHaveBeenCalled()
    const numOfReservations = await prisma.reservation.count()
    expect(numOfReservations).toBe(0)
  })
})
