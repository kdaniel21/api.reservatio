import supertest from 'supertest'
import crypto from 'crypto'
import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { Customer, PrismaClient, User } from '@prisma/client'
import { applyMiddleware } from 'src/apply-middleware'
import clearAllData from 'test/setup/clear-all-data'
import jwt from 'jsonwebtoken'
import { JwtPayload } from '@auth/services/access-token/dto/jwt-payload.interface'
import { ReservationModule } from 'src/modules/reservation/reservation.module'
import { advanceTo } from 'jest-date-mock'
import { TimesAvailabilityService } from '@reservation/services/times-availability/times-availability.service'

describe('IsRecurringTimeAvailable E2E', () => {
  let app: INestApplication
  let request: supertest.SuperTest<supertest.Test>
  let prisma: PrismaClient
  let config: ConfigService

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
    config = moduleRef.get<ConfigService>(ConfigService)
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await clearAllData()

    advanceTo(new Date('2021-05-03 10:00:00'))

    user = await prisma.user.create({
      data: {
        email: 'foo@bar.com',
        password: crypto.randomBytes(20).toString('hex'),
        isEmailConfirmed: true,
      },
    })

    customer = await prisma.customer.create({
      data: {
        userId: user.id,
        name: 'Foo Bar',
      },
    })

    accessToken = jwt.sign(
      { userId: user.id, email: user.email, customerId: customer.id, customerRole: customer.role } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )

    jest.spyOn(TimesAvailabilityService.prototype, 'isRecurringTimeAvailable')
    jest.clearAllMocks()
  })

  it(`should calculate all dates with a weekly recurrence for the current year and return as available if 
  there are no other reservations`, async () => {
    await prisma.reservation.deleteMany()
    const startTime = new Date('2021-05-04 11:00')
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${startTime}",
        endTime: "${new Date('2021-05-04 13:00')}",
        recurrence: WEEKLY,
        timePeriod: CURRENT_YEAR,
        locations: { tableTennis: true }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.isRecurringTimeAvailable.availableTimes.length).toBe(35)
    expect(res.body.data.isRecurringTimeAvailable.unavailableTimes.length).toBe(0)
    const dates = [...Array(35).keys()].map((_, index) => {
      const date = new Date(startTime)
      date.setDate(date.getDate() + index * 7)
      return date.toJSON()
    })
    expect(res.body.data.isRecurringTimeAvailable.availableTimes).toIncludeAllMembers(dates)
  })

  it(`should calculate all dates with a weekly recurrence for half a year and return as available if 
  there are no other reservations`, async () => {
    await prisma.reservation.deleteMany()
    const startTime = new Date('2021-05-04 11:00')
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${startTime}",
        endTime: "${new Date('2021-05-04 13:00')}",
        recurrence: WEEKLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.isRecurringTimeAvailable.availableTimes.length).toBe(27)
    expect(res.body.data.isRecurringTimeAvailable.unavailableTimes.length).toBe(0)
    const dates = [...Array(27).keys()].map((_, index) => {
      const date = new Date(startTime)
      date.setDate(date.getDate() + index * 7)
      return date.toJSON()
    })
    expect(res.body.data.isRecurringTimeAvailable.availableTimes).toIncludeAllMembers(dates)
  })

  it(`should calculate all dates with a monthly recurrence for the current year and return as available if 
  there are no other reservations`, async () => {
    await prisma.reservation.deleteMany()
    const startTime = new Date('2021-05-04 11:00')
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${startTime}",
        endTime: "${new Date('2021-05-04 13:00')}",
        recurrence: MONTHLY,
        timePeriod: CURRENT_YEAR,
        locations: { tableTennis: true }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.isRecurringTimeAvailable.availableTimes.length).toBe(8)
    expect(res.body.data.isRecurringTimeAvailable.unavailableTimes.length).toBe(0)
    const dates = [...Array(6).keys()].map((_, index) => {
      const date = new Date(startTime)
      date.setMonth(startTime.getMonth() + index)
      return date.toJSON()
    })
    expect(res.body.data.isRecurringTimeAvailable.availableTimes).toIncludeAllMembers(dates)
  })

  it(`should calculate all dates with a monthly recurrence for half a year and return as available if 
  there are no other reservations`, async () => {
    await prisma.reservation.deleteMany()
    const startTime = new Date('2021-05-04 11:00')
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${startTime}",
        endTime: "${new Date('2021-05-04 13:00')}",
        recurrence: MONTHLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.isRecurringTimeAvailable.availableTimes.length).toBe(6)
    expect(res.body.data.isRecurringTimeAvailable.unavailableTimes.length).toBe(0)
    const dates = [...Array(6).keys()].map((_, index) => {
      const date = new Date(startTime)
      date.setMonth(startTime.getMonth() + index)
      return date.toJSON()
    })
    expect(res.body.data.isRecurringTimeAvailable.availableTimes).toIncludeAllMembers(dates)
  })

  it('should return the not available times for a period with given recurrence', async () => {
    await prisma.reservation.create({
      data: {
        customerId: customer.id,
        name: 'Single Reservation 1',
        startTime: new Date('2021-07-04 11:15'),
        endTime: new Date('2021-07-04 12:15'),
        tableTennis: true,
      },
    })
    const startTime = new Date('2021-05-04 11:00')
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${startTime}",
        endTime: "${new Date('2021-05-04 13:00')}",
        recurrence: MONTHLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.isRecurringTimeAvailable.availableTimes.length).toBe(5)
    expect(res.body.data.isRecurringTimeAvailable.unavailableTimes.length).toBe(1)
    expect(res.body.data.isRecurringTimeAvailable.unavailableTimes[0]).toEqual(new Date('2021-07-04 11:00').toJSON())
    const dates = [...Array(6).keys()]
      .map((_, index) => {
        const date = new Date(startTime)
        date.setMonth(startTime.getMonth() + index)
        return date.toJSON()
      })
      .filter((date) => date !== new Date('2021-07-04 11:00').toJSON())
    expect(res.body.data.isRecurringTimeAvailable.availableTimes).toIncludeAllMembers(dates)
  })

  it('should all calculated times as valid if it only collides with a reservation for a different location', async () => {
    await prisma.reservation.create({
      data: {
        customerId: customer.id,
        name: 'Single Reservation 1',
        startTime: new Date('2021-07-04 11:15'),
        endTime: new Date('2021-07-04 12:15'),
        badminton: true,
      },
    })
    const startTime = new Date('2021-05-04 11:00')
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${startTime}",
        endTime: "${new Date('2021-05-04 13:00')}",
        recurrence: MONTHLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.isRecurringTimeAvailable.availableTimes.length).toBe(6)
    expect(res.body.data.isRecurringTimeAvailable.unavailableTimes.length).toBe(0)
    const dates = [...Array(6).keys()].map((_, index) => {
      const date = new Date(startTime)
      date.setMonth(startTime.getMonth() + index)
      return date.toJSON()
    })
    expect(res.body.data.isRecurringTimeAvailable.availableTimes).toIncludeAllMembers(dates)
  })

  it('should not validate the excluded dates', async () => {
    await prisma.reservation.create({
      data: {
        customerId: customer.id,
        name: 'Single Reservation 1',
        startTime: new Date('2021-07-04 11:15'),
        endTime: new Date('2021-07-04 12:15'),
        tableTennis: true,
      },
    })
    const startTime = new Date('2021-05-04 11:00')
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${startTime}",
        endTime: "${new Date('2021-05-04 13:00')}",
        recurrence: MONTHLY,
        timePeriod: HALF_YEAR,
        excludedDates: ["${new Date('2021-07-04 11:00')}"]
        locations: { tableTennis: true }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.isRecurringTimeAvailable.availableTimes.length).toBe(5)
    expect(res.body.data.isRecurringTimeAvailable.unavailableTimes.length).toBe(0)
    const dates = [...Array(6).keys()]
      .map((_, index) => {
        const date = new Date(startTime)
        date.setMonth(startTime.getMonth() + index)
        return date.toJSON()
      })
      .filter((date) => date !== new Date('2021-07-04 11:00').toJSON())
    expect(res.body.data.isRecurringTimeAvailable.availableTimes).toIncludeAllMembers(dates)
  })

  it('should include the included dates into the validation', async () => {
    const startTime = new Date('2021-05-04 11:00')
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${startTime}",
        endTime: "${new Date('2021-05-04 13:00')}",
        recurrence: MONTHLY,
        timePeriod: HALF_YEAR,
        includedDates: ["${new Date('2021-05-06 11:00')}"]
        locations: { tableTennis: true }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.isRecurringTimeAvailable.availableTimes.length).toBe(7)
    expect(res.body.data.isRecurringTimeAvailable.unavailableTimes.length).toBe(0)
    const dates = [...Array(6).keys()].map((_, index) => {
      const date = new Date(startTime)
      date.setMonth(startTime.getMonth() + index)
      return date.toJSON()
    })
    expect(res.body.data.isRecurringTimeAvailable.availableTimes).toIncludeAllMembers([
      ...dates,
      new Date('2021-05-06 11:00').toJSON(),
    ])
  })

  it('should make only one request to the database', async () => {
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${new Date('2021-05-04 11:00')}",
        endTime: "${new Date('2021-05-04 13:00')}",
        recurrence: MONTHLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.isRecurringTimeAvailable.availableTimes.length).toBe(6)
    expect(res.body.data.isRecurringTimeAvailable.unavailableTimes.length).toBe(0)
    expect(TimesAvailabilityService.prototype.isRecurringTimeAvailable).toHaveBeenCalledTimes(1)
  })

  it(`should throw a ValidationError if the difference between 'startTime' and 'endTime' exceeds the maximum time frame`, async () => {
    const startTime = new Date('2021-05-04 11:00')
    const endTime = new Date(startTime)
    endTime.setHours(endTime.getHours() + 5)
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${startTime}",
        endTime: "${endTime}",
        recurrence: MONTHLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(TimesAvailabilityService.prototype.isRecurringTimeAvailable).toHaveBeenCalledTimes(0)
  })

  it(`should throw a ValidationError if the difference between 'startTime' and 'endTime' is less than the minimum time frame`, async () => {
    const startTime = new Date('2021-05-04 11:00')
    const endTime = new Date(startTime)
    endTime.setHours(endTime.getHours() + 0.25)
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${startTime}",
        endTime: "${endTime}",
        recurrence: MONTHLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(TimesAvailabilityService.prototype.isRecurringTimeAvailable).toHaveBeenCalledTimes(0)
  })

  it('should throw an NotAuthenticated if no access token is provided', async () => {
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 14:00')}",
        recurrence: MONTHLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('NOT_AUTHENTICATED')
    expect(TimesAvailabilityService.prototype.isRecurringTimeAvailable).toHaveBeenCalledTimes(0)
  })

  it('should throw a ValidationError if both locations are false', async () => {
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${new Date('2021-05-04 12:00')}",
        endTime: "${new Date('2021-05-04 14:00')}",
        recurrence: MONTHLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: false, badminton: false }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(TimesAvailabilityService.prototype.isRecurringTimeAvailable).toHaveBeenCalledTimes(0)
  })

  it(`should throw a GraphQL validation error if there is no 'startTime' argument`, async () => {
    const query = `query {
      isRecurringTimeAvailable(
        endTime: "${new Date('2021-05-04 14:00')}",
        recurrence: MONTHLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    expect(TimesAvailabilityService.prototype.isRecurringTimeAvailable).toHaveBeenCalledTimes(0)
  })

  it(`should throw a GraphQL validation error if there is no 'endTime' argument`, async () => {
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${new Date('2021-05-04 14:00')}",
        recurrence: MONTHLY,
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    expect(TimesAvailabilityService.prototype.isRecurringTimeAvailable).toHaveBeenCalledTimes(0)
  })

  it(`should use the 'HalfYear' value if there is no 'timePeriod' argument specified`, async () => {
    const startTime = new Date('2021-05-04 11:00')
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${startTime}",
        endTime: "${new Date('2021-05-04 13:00')}",
        recurrence: WEEKLY,
        locations: { tableTennis: true }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.isRecurringTimeAvailable.availableTimes.length).toBe(27)
    expect(res.body.data.isRecurringTimeAvailable.unavailableTimes.length).toBe(0)
    const dates = [...Array(27).keys()].map((_, index) => {
      const date = new Date(startTime)
      date.setDate(date.getDate() + index * 7)
      return date.toJSON()
    })
    expect(res.body.data.isRecurringTimeAvailable.availableTimes).toIncludeAllMembers(dates)
  })

  it(`should use the 'Weekly' value if there is no 'recurrence' argument specified`, async () => {
    const startTime = new Date('2021-05-04 11:00')
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${startTime}",
        endTime: "${new Date('2021-05-04 13:00')}",
        timePeriod: HALF_YEAR,
        locations: { tableTennis: true }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.isRecurringTimeAvailable.availableTimes.length).toBe(27)
    expect(res.body.data.isRecurringTimeAvailable.unavailableTimes.length).toBe(0)
    const dates = [...Array(27).keys()].map((_, index) => {
      const date = new Date(startTime)
      date.setDate(date.getDate() + index * 7)
      return date.toJSON()
    })
    expect(res.body.data.isRecurringTimeAvailable.availableTimes).toIncludeAllMembers(dates)
  })

  it(`should throw a GraphQL validation error if there is no 'locations' argument`, async () => {
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${new Date('2021-05-04 14:00')}",
        endTime: "${new Date('2021-05-04 14:00')}",
        timePeriod: HALF_YEAR,
        recurrence: MONTHLY
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    expect(TimesAvailabilityService.prototype.isRecurringTimeAvailable).toHaveBeenCalledTimes(0)
  })

  it('should throw a ValidationError if the reservation starts in the past', async () => {
    const query = `query {
      isRecurringTimeAvailable(
        startTime: "${new Date('2021-05-02 14:00')}",
        endTime: "${new Date('2021-05-02 15:00')}",
        timePeriod: HALF_YEAR,
        recurrence: MONTHLY,
        locations: { badminton: true }
      ) {
        availableTimes
        unavailableTimes
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(TimesAvailabilityService.prototype.isRecurringTimeAvailable).toHaveBeenCalledTimes(0)
  })
})
