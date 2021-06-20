import supertest from 'supertest'
import crypto from 'crypto'
import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { Customer, CustomerRole, Prisma, PrismaClient, Reservation, User } from '@prisma/client'
import { applyMiddleware } from 'src/apply-middleware'
import clearAllData from 'test/setup/clear-all-data'
import jwt from 'jsonwebtoken'
import { JwtPayload } from '@auth/services/access-token/dto/jwt-payload.interface'
import { ReservationModule } from 'src/modules/reservation/reservation.module'
import { advanceTo } from 'jest-date-mock'
import { TimesAvailabilityService } from '@reservation/services/times-availability/times-availability.service'
import { TextUtils } from '@common/utils/text-utils'
import { PrismaService } from '@common/services/prisma.service'
import { add, addHours } from 'date-fns'

describe('UpdateReservation Integration', () => {
  let app: INestApplication
  let request: supertest.SuperTest<supertest.Test>
  let prisma: PrismaClient
  let config: ConfigService
  let prismaService: PrismaService

  let user: User
  let customer: Customer
  let accessToken: string
  let adminAccessToken: string
  let reservationToUpdate: Partial<Reservation>
  let reservations: Partial<Reservation>[]

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

    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@bar.com',
        password: crypto.randomBytes(20).toString('hex'),
        isEmailConfirmed: true,
      },
    })
    const adminCustomer = await prisma.customer.create({
      data: {
        userId: adminUser.id,
        name: 'Foo Bar',
        role: CustomerRole.ADMIN,
      },
    })
    adminAccessToken = jwt.sign(
      {
        userId: adminUser.id,
        email: adminUser.email,
        customerRole: adminCustomer.role,
        customerId: adminCustomer.id,
      } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )

    reservations = [
      {
        id: TextUtils.generateUuid(),
        name: 'Past 1',
        startTime: new Date('2021-05-01 10:00:00'),
        endTime: new Date('2021-05-01 12:00:00'),
        badminton: true,
        tableTennis: false,
        customerId: customer.id,
        isActive: true,
      },
      {
        id: TextUtils.generateUuid(),
        name: 'Future 1',
        startTime: new Date('2021-05-08 10:00:00'),
        endTime: new Date('2021-05-08 12:00:00'),
        badminton: true,
        tableTennis: false,
        customerId: customer.id,
        isActive: true,
      },
      {
        id: TextUtils.generateUuid(),
        name: 'Future 2',
        startTime: new Date('2021-05-15 10:00:00'),
        endTime: new Date('2021-05-15 12:00:00'),
        badminton: true,
        tableTennis: false,
        customerId: customer.id,
        isActive: true,
      },
      {
        id: TextUtils.generateUuid(),
        name: 'Future 3',
        startTime: new Date('2021-05-22 10:00:00'),
        endTime: new Date('2021-05-22 12:00:00'),
        badminton: true,
        tableTennis: false,
        customerId: customer.id,
        isActive: true,
      },
    ]
    await prisma.reservation.createMany({ data: reservations as Prisma.ReservationCreateManyInput[] })

    reservationToUpdate = { ...reservations[1] }

    jest.spyOn(prismaService, '$transaction')
    jest.spyOn(prismaService.reservation, 'update')
    jest.spyOn(prismaService.reservation, 'updateMany')
    jest.spyOn(TimesAvailabilityService.prototype, 'areTimesAvailable')
    jest.clearAllMocks()
  })

  it('should update the name of a single reservation', async () => {
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          name: "updated name"
        }
      ) {
        id
        recurringId
        name
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.updateReservation.id).toBe(reservationToUpdate.id)
    expect(res.body.data.updateReservation.name).toBe('updated name')
    expect(res.body.data.updateReservation.recurringId).toBeFalsy()
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe('updated name')
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(1)
  })

  it('should return the updated reservation with all fields', async () => {
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          name: "updated name"
        }
      ) {
        id
        recurringId
        isActive
        name
        startTime
        endTime
        locations {
          badminton
          tableTennis
        }
        customer {
          id
          name
          role
          user {
            id
            email
          }
        }
        createdAt
        updatedAt
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.updateReservation.id).toBe(reservationToUpdate.id)
    expect(res.body.data.updateReservation.name).toBe('updated name')
    expect(res.body.data.updateReservation.isActive).toBe(reservationToUpdate.isActive)
    expect(res.body.data.updateReservation.recurringId).toBeFalsy()
    expect(res.body.data.updateReservation.startTime).toBeTruthy()
    expect(res.body.data.updateReservation.endTime).toBeTruthy()
    expect(res.body.data.updateReservation.locations.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(res.body.data.updateReservation.locations.badminton).toBe(reservationToUpdate.badminton)
    expect(res.body.data.updateReservation.customer.name).toBe(customer.name)
    expect(res.body.data.updateReservation.customer.id).toBe(customer.id)
    expect(res.body.data.updateReservation.customer.role).toEqualCaseInsensitive(customer.role)
    expect(res.body.data.updateReservation.customer.user.id).toBe(user.id)
    expect(res.body.data.updateReservation.customer.user.email).toBe(user.email)
    expect(res.body.data.updateReservation.createdAt).toBeTruthy()
    expect(res.body.data.updateReservation.updatedAt).toBeTruthy()
  })

  it('should update both the start and end time of a single reservation', async () => {
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          startTime: "${new Date('2021-05-09 9:00')}",
          endTime: "${new Date('2021-05-09 10:30')}"
        }
      ) {
        id
        startTime
        endTime
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`) //.expect(200)

    expect(res.body.data.updateReservation.id).toBe(reservationToUpdate.id)
    expect(res.body.data.updateReservation.startTime).toEqual(new Date('2021-05-09 9:00').toJSON())
    expect(res.body.data.updateReservation.endTime).toEqual(new Date('2021-05-09 10:30').toJSON())
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(new Date('2021-05-09 9:00'))
    expect(updatedRecord.endTime).toEqual(new Date('2021-05-09 10:30'))
    expect(prismaService.$transaction).toHaveBeenCalledTimes(2)
  })

  it('should throw a ValidationError if the updated length is smaller than the minimum allowed', async () => {
    const startTime = new Date('2021-05-04 11:00')
    const endTime = new Date(startTime)
    endTime.setHours(endTime.getHours() + 0.25)
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          startTime: "${startTime}",
          endTime: "${endTime}"
        }
      ) {
        id
        startTime
        endTime
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(0)
  })

  it('should throw a ValidationError if the updated length is longer than the maximum allowed', async () => {
    const startTime = new Date('2021-05-04 11:00')
    const endTime = addHours(startTime, 5)
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          startTime: "${startTime}",
          endTime: "${endTime}"
        }
      ) {
        id
        startTime
        endTime
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(0)
  })

  it('should throw a TimeNotAvailable if the new time is not available', async () => {
    await prisma.reservation.create({
      data: {
        name: 'Collapsing reservation',
        startTime: new Date('2021-05-09 10:00:00'),
        endTime: new Date('2021-05-09 11:30:00'),
        badminton: true,
        tableTennis: true,
        customerId: customer.id,
        isActive: true,
      },
    })
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          startTime: "${new Date('2021-05-09 9:00')}",
          endTime: "${new Date('2021-05-09 10:30')}"
        }
      ) {
        id
        startTime
        endTime
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('TIME_NOT_AVAILABLE')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(1)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(1)
  })

  it('should de-activate a single reservation', async () => {
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          isActive: false
        }
      ) {
        id
        isActive
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.updateReservation.id).toBe(reservationToUpdate.id)
    expect(res.body.data.updateReservation.isActive).toBe(false)
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(updatedRecord.isActive).toBe(false)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(2)
  })

  it('should update both locations of a single reservation', async () => {
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          locations: {
            badminton: false,
            tableTennis: true
          }
        }
      ) {
        id
        locations {
          badminton
          tableTennis
        }
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.updateReservation.id).toBe(reservationToUpdate.id)
    expect(res.body.data.updateReservation.locations.badminton).toBe(false)
    expect(res.body.data.updateReservation.locations.tableTennis).toBe(true)
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(false)
    expect(updatedRecord.tableTennis).toBe(true)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(updatedRecord.isActive).toBe(true)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(2)
  })

  it('should update only a single location of a single reservation', async () => {
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          locations: {
            tableTennis: true
          }
        }
      ) {
        id
        locations {
          badminton
          tableTennis
        }
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.updateReservation.id).toBe(reservationToUpdate.id)
    expect(res.body.data.updateReservation.locations.badminton).toBe(true)
    expect(res.body.data.updateReservation.locations.tableTennis).toBe(true)
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(true)
    expect(updatedRecord.tableTennis).toBe(true)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(updatedRecord.isActive).toBe(true)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(2)
  })

  it('should throw a TimeNotAvailable if the updated location is not available', async () => {
    await prisma.reservation.create({
      data: {
        name: 'Collapsing reservation',
        startTime: new Date('2021-05-08 10:30:00'),
        endTime: new Date('2021-05-08 12:30:00'),
        badminton: false,
        tableTennis: true,
        customerId: customer.id,
        isActive: true,
      },
    })
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          locations: {
            tableTennis: true
          }
        }
      ) {
        id
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('TIME_NOT_AVAILABLE')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(1)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(1)
  })

  it('should throw a NotAuthenticated if no access token is provided', async () => {
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          startTime: "${new Date('2021-05-09 9:00')}",
          endTime: "${new Date('2021-05-09 10:30')}"
        }
      ) {
        id
        startTime
        endTime
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('NOT_AUTHENTICATED')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(0)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(0)
  })

  it('should throw a GraphQL validation error if no ID is provided', async () => {
    const query = `mutation {
      updateReservation(
        updatedProperties: {
          startTime: "${new Date('2021-05-09 9:00')}",
          endTime: "${new Date('2021-05-09 10:30')}"
        }
      ) {
        id
        startTime
        endTime
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(0)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(0)
  })

  it('should throw a GraphQL validation error if the customer property is updated', async () => {
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          startTime: "${new Date('2021-05-09 9:00')}",
          endTime: "${new Date('2021-05-09 10:30')}",
          customer: "foo"
        }
      ) {
        id
        startTime
        endTime
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(0)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(0)
  })

  it('should throw a GraphQL validation error if the customerId property is updated', async () => {
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          startTime: "${new Date('2021-05-09 9:00')}",
          endTime: "${new Date('2021-05-09 10:30')}",
          customerId: "foo"
        }
      ) {
        id
        startTime
        endTime
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(updatedRecord.customerId).toBe(customer.id)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(0)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(0)
  })

  it('should throw a GraphQL validation error if the createdAt property is updated', async () => {
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          startTime: "${new Date('2021-05-09 9:00')}",
          endTime: "${new Date('2021-05-09 10:30')}",
          createdAt: "${new Date()}"
        }
      ) {
        id
        startTime
        endTime
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(0)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(0)
  })

  it('should throw a GraphQL validation error if the updatedAt property is updated', async () => {
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          startTime: "${new Date('2021-05-09 9:00')}",
          endTime: "${new Date('2021-05-09 10:30')}",
          updatedAt: "${new Date()}"
        }
      ) {
        id
        startTime
        endTime
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(0)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(0)
  })

  it('should throw a ReservationNotAuthorized if the reservation does not belong to the user', async () => {
    const otherUser = await prisma.user.create({
      data: {
        email: 'other@bar.com',
        password: crypto.randomBytes(20).toString('hex'),
        isEmailConfirmed: true,
      },
    })
    const otherCustomer = await prisma.customer.create({
      data: { userId: otherUser.id, name: 'Foo Bar' },
    })
    const otherUserAccessToken = jwt.sign(
      {
        userId: otherUser.id,
        email: otherUser.email,
        customerId: otherCustomer.id,
        customerRole: otherCustomer.role,
      } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          startTime: "${new Date('2021-05-09 9:00')}",
          endTime: "${new Date('2021-05-09 10:30')}",
        }
      ) {
        id
        startTime
        endTime
      }
    }`

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Authorization', `Bearer ${otherUserAccessToken}`)
      .expect(200)

    expect(res.body.errors[0].extensions.code).toBe('RESERVATION_NOT_AUTHORIZED')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(0)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(0)
  })

  it('should not throw a ReservationNotAuthorized if the reservation does not belong to the user, yet the user is an admin', async () => {
    const query = `mutation {
        updateReservation(
          id: "${reservationToUpdate.id}",
          updatedProperties: {
            name: "updated name"
          }
        ) {
          id
          name
        }
      }`

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)

    expect(res.body.data.updateReservation.id).toBe(reservationToUpdate.id)
    expect(res.body.data.updateReservation.name).toBe('updated name')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe('updated name')
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(1)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(0)
  })

  it('should update the name of the connected reservations as well', async () => {
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          name: "updated name"
        },
        connectedUpdates: [
          "${reservations[2].id}"
        ]
      ) {
        id
        name
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.updateReservation.id).toBe(reservationToUpdate.id)
    expect(res.body.data.updateReservation.name).toBe('updated name')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe('updated name')
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    const connectedUpdatedRecord = await prisma.reservation.findUnique({ where: { id: reservations[2].id } })
    expect(connectedUpdatedRecord.name).toBe('updated name')
    expect(connectedUpdatedRecord.badminton).toBe(reservations[2].badminton)
    expect(connectedUpdatedRecord.tableTennis).toBe(reservations[2].tableTennis)
    expect(connectedUpdatedRecord.startTime).toEqual(reservations[2].startTime)
    expect(connectedUpdatedRecord.endTime).toEqual(reservations[2].endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(1)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(0)
  })

  it('should update the location of the connected reservations as well', async () => {
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          locations: {
            tableTennis: true,
            badminton: false
          }
        },
        connectedUpdates: [
          "${reservations[2].id}"
        ]
      ) {
        id
        locations {
          badminton
          tableTennis
        }
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.updateReservation.id).toBe(reservationToUpdate.id)
    expect(res.body.data.updateReservation.locations.tableTennis).toBe(true)
    expect(res.body.data.updateReservation.locations.badminton).toBe(false)
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(false)
    expect(updatedRecord.tableTennis).toBe(true)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    const connectedUpdatedRecord = await prisma.reservation.findUnique({ where: { id: reservations[2].id } })
    expect(connectedUpdatedRecord.name).toBe(reservations[2].name)
    expect(connectedUpdatedRecord.badminton).toBe(false)
    expect(connectedUpdatedRecord.tableTennis).toBe(true)
    expect(connectedUpdatedRecord.startTime).toEqual(reservations[2].startTime)
    expect(connectedUpdatedRecord.endTime).toEqual(reservations[2].endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(2)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(1)
  })

  it('should update the time of the connected reservations with the original difference', async () => {
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          startTime: "${new Date('2021-05-08 10:30')}",
          endTime: "${new Date('2021-05-08 12:30')}"
        },
        connectedUpdates: [
          "${reservations[2].id}",
        ]
      ) {
        id
        startTime
        endTime
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.updateReservation.id).toBe(reservationToUpdate.id)
    expect(res.body.data.updateReservation.startTime).toEqual(new Date('2021-05-08 10:30').toJSON())
    expect(res.body.data.updateReservation.endTime).toEqual(new Date('2021-05-08 12:30').toJSON())
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(true)
    expect(updatedRecord.tableTennis).toBe(false)
    expect(updatedRecord.startTime).toEqual(new Date('2021-05-08 10:30'))
    expect(updatedRecord.endTime).toEqual(new Date('2021-05-08 12:30'))
    const connectedUpdatedRecord = await prisma.reservation.findUnique({ where: { id: reservations[2].id } })
    expect(connectedUpdatedRecord.name).toBe(reservations[2].name)
    expect(connectedUpdatedRecord.badminton).toBe(true)
    expect(connectedUpdatedRecord.tableTennis).toBe(false)
    expect(connectedUpdatedRecord.startTime).toEqual(add(reservations[2].startTime, { minutes: 30 }))
    expect(connectedUpdatedRecord.endTime).toEqual(add(reservations[2].endTime, { minutes: 30 }))
    expect(prismaService.$transaction).toHaveBeenCalledTimes(2)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(1)
  })

  it('should throw a TimeNotAvailable if at least one of the connected updates are not available', async () => {
    await prisma.reservation.create({
      data: {
        name: 'Collapsing',
        startTime: new Date('2021-05-22 9:00:00'),
        endTime: new Date('2021-05-22 12:00:00'),
        badminton: true,
        tableTennis: false,
        customerId: customer.id,
        isActive: true,
      },
    })
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          startTime: "${new Date('2021-05-08 10:30')}",
          endTime: "${new Date('2021-05-08 12:00')}"
        },
        connectedUpdates: [
          "${reservations[2].id}",
          "${reservations[3].id}"
        ]
      ) {
        id
        startTime
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('TIME_NOT_AVAILABLE')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(true)
    expect(updatedRecord.tableTennis).toBe(false)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    const connectedUpdatedRecord = await prisma.reservation.findUnique({ where: { id: reservations[2].id } })
    expect(connectedUpdatedRecord.name).toBe(reservations[2].name)
    expect(connectedUpdatedRecord.badminton).toBe(true)
    expect(connectedUpdatedRecord.tableTennis).toBe(false)
    expect(connectedUpdatedRecord.startTime).toEqual(reservations[2].startTime)
    expect(connectedUpdatedRecord.endTime).toEqual(reservations[2].endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(1)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(1)
  })

  it('should throw a ReservationNotAuthorized if a past reservation is being updated', async () => {
    const query = `mutation {
      updateReservation(
        id: "${reservations[0].id}",
        updatedProperties: {
          name: "updated name"
        }
      ) {
        id
        recurringId
        name
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('RESERVATION_NOT_AUTHORIZED')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservations[0].id } })
    expect(updatedRecord.name).toBe(reservations[0].name)
    expect(updatedRecord.badminton).toBe(reservations[0].badminton)
    expect(updatedRecord.tableTennis).toBe(reservations[0].tableTennis)
    expect(updatedRecord.startTime).toEqual(reservations[0].startTime)
    expect(updatedRecord.endTime).toEqual(reservations[0].endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(0)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(0)
  })

  it('should allow admins to edit past reservations', async () => {
    const query = `mutation {
      updateReservation(
        id: "${reservations[0].id}",
        updatedProperties: {
          name: "updated name"
        }
      ) {
        id
        name
      }
    }`

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)

    expect(res.body.data.updateReservation.name).toBe('updated name')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservations[0].id } })
    expect(updatedRecord.name).toBe('updated name')
    expect(updatedRecord.badminton).toBe(reservations[0].badminton)
    expect(updatedRecord.tableTennis).toBe(reservations[0].tableTennis)
    expect(updatedRecord.startTime).toEqual(reservations[0].startTime)
    expect(updatedRecord.endTime).toEqual(reservations[0].endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(1)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(0)
  })

  it('should throw ReservationNotAuthorized if an inactive reservation is updated', async () => {
    await prisma.reservation.update({ where: { id: reservationToUpdate.id }, data: { isActive: false } })
    jest.clearAllMocks()
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          name: "updated name"
        }
      ) {
        id
        recurringId
        name
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('RESERVATION_NOT_AUTHORIZED')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe(reservationToUpdate.name)
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(0)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(0)
  })

  it('should allow admins to update inactive reservations', async () => {
    await prisma.reservation.update({ where: { id: reservationToUpdate.id }, data: { isActive: false } })
    jest.clearAllMocks()
    const query = `mutation {
      updateReservation(
        id: "${reservationToUpdate.id}",
        updatedProperties: {
          name: "updated name"
        }
      ) {
        id
        recurringId
        name
      }
    }`

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)

    expect(res.body.data.updateReservation.name).toBe('updated name')
    const updatedRecord = await prisma.reservation.findUnique({ where: { id: reservationToUpdate.id } })
    expect(updatedRecord.name).toBe('updated name')
    expect(updatedRecord.badminton).toBe(reservationToUpdate.badminton)
    expect(updatedRecord.tableTennis).toBe(reservationToUpdate.tableTennis)
    expect(updatedRecord.startTime).toEqual(reservationToUpdate.startTime)
    expect(updatedRecord.endTime).toEqual(reservationToUpdate.endTime)
    expect(prismaService.$transaction).toHaveBeenCalledTimes(1)
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(0)
  })
})
