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

describe('GetRecurringReservations', () => {
  let app: INestApplication
  let request: supertest.SuperTest<supertest.Test>
  let prisma: PrismaClient
  let config: ConfigService

  let user: User
  let customer: Customer
  let accessToken: string
  let reservations: Partial<Reservation>[]
  let recurringId: string

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
      data: { userId: user.id, name: 'Foo Bar' },
    })

    accessToken = jwt.sign(
      { userId: user.id, email: user.email, customerRole: customer.role, customerId: customer.id } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )

    recurringId = TextUtils.generateUuid()
    reservations = [
      {
        id: TextUtils.generateUuid(),
        recurringId: recurringId.toString(),
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
        recurringId: recurringId.toString(),
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
        recurringId: recurringId.toString(),
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
        recurringId: recurringId.toString(),
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

    jest.clearAllMocks()
  })

  it(`should get all reservations that belong to the same 'recurringId' and are active`, async () => {
    await prisma.reservation.create({
      data: {
        id: TextUtils.generateUuid(),
        recurringId: recurringId.toString(),
        name: 'Deactivated future 5',
        startTime: new Date('2021-05-28 10:00:00'),
        endTime: new Date('2021-05-28 12:00:00'),
        badminton: true,
        tableTennis: false,
        customerId: customer.id,
        isActive: false,
      },
    })
    const query = `query {
      recurringReservations(recurringId: "${recurringId.toString()}") {
        id
        recurringId
        name
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.recurringReservations.length).toBe(4)
    const responseIds = res.body.data.recurringReservations.map((reservation: any) => reservation.id)
    const reservationIds = reservations.map((reservation) => reservation.id)
    expect(responseIds).toIncludeSameMembers(reservationIds)
    const responseNames = res.body.data.recurringReservations.map((reservation: any) => reservation.name)
    const reservationNames = reservations.map((reservation) => reservation.name)
    expect(responseNames).toIncludeSameMembers(reservationNames)
  })

  it(`should be able to fetch the same properties as the 'reservations' query`, async () => {
    const query = `query {
      recurringReservations(recurringId: "${recurringId.toString()}") {
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

    expect(res.body.data.recurringReservations[0].id).toBe(reservations[0].id)
    expect(res.body.data.recurringReservations[0].name).toBe(reservations[0].name)
    expect(res.body.data.recurringReservations[0].isActive).toBe(reservations[0].isActive)
    expect(res.body.data.recurringReservations[0].recurringId).toBe(reservations[0].recurringId)
    expect(res.body.data.recurringReservations[0].startTime).toBeTruthy()
    expect(res.body.data.recurringReservations[0].endTime).toBeTruthy()
    expect(res.body.data.recurringReservations[0].locations.tableTennis).toBe(reservations[0].tableTennis)
    expect(res.body.data.recurringReservations[0].locations.badminton).toBe(reservations[0].badminton)
    expect(res.body.data.recurringReservations[0].customer.name).toBe(customer.name)
    expect(res.body.data.recurringReservations[0].customer.id).toBe(customer.id)
    expect(res.body.data.recurringReservations[0].customer.role).toEqualCaseInsensitive(customer.role)
    expect(res.body.data.recurringReservations[0].customer.user.id).toBe(user.id)
    expect(res.body.data.recurringReservations[0].customer.user.email).toBe(user.email)
    expect(res.body.data.recurringReservations[0].createdAt).toBeTruthy()
    expect(res.body.data.recurringReservations[0].updatedAt).toBeTruthy()
  })

  it(`should get all future reservations that belong to the same 'recurringId'`, async () => {
    const query = `query {
      recurringReservations(recurringId: "${recurringId.toString()}", futureOnly: true) {
        id
        recurringId
        name
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    reservations.splice(0, 1)
    expect(res.body.data.recurringReservations.length).toBe(3)
    const responseIds = res.body.data.recurringReservations.map((reservation: any) => reservation.id)
    const reservationIds = reservations.map((reservation) => reservation.id)
    expect(responseIds).toIncludeSameMembers(reservationIds)
    const responseNames = res.body.data.recurringReservations.map((reservation: any) => reservation.name)
    const reservationNames = reservations.map((reservation) => reservation.name)
    expect(responseNames).toIncludeSameMembers(reservationNames)
  })

  it('should throw a ReservationNotAuthorized error if the reservations do not belong to the user', async () => {
    const otherUser = await prisma.user.create({
      data: {
        id: TextUtils.generateUuid(),
        email: 'other@bar.com',
        password: crypto.randomBytes(20).toString('hex'),
        isEmailConfirmed: true,
      },
    })
    const otherCustomer = await prisma.customer.create({
      data: {
        id: TextUtils.generateUuid(),
        userId: otherUser.id,
        name: 'Foo Bar',
      },
    })
    const otherUserAccessToken = jwt.sign(
      {
        userId: otherUser.id,
        email: otherUser.email,
        customerRole: otherCustomer.role,
        customerId: otherCustomer.id,
      } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )

    const query = `query {
      recurringReservations(recurringId: "${recurringId.toString()}") {
        id
        recurringId
        name
      }
    }`

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Authorization', `Bearer ${otherUserAccessToken}`)
      .expect(200)

    expect(res.body.errors[0].extensions.code).toBe('RESERVATION_NOT_AUTHORIZED')
  })

  it('should not throw a NotAuthorizedError if the reservation do not belong to the user but the user is an admin', async () => {
    const adminUser = await prisma.user.create({
      data: {
        id: TextUtils.generateUuid(),
        email: 'admin@bar.com',
        password: crypto.randomBytes(20).toString('hex'),
        isEmailConfirmed: true,
      },
    })
    const adminCustomer = await prisma.customer.create({
      data: {
        id: TextUtils.generateUuid(),
        userId: adminUser.id,
        name: 'Foo Bar',
        role: CustomerRole.ADMIN,
      },
    })
    const adminAccessToken = jwt.sign(
      {
        userId: adminUser.id,
        email: adminUser.email,
        customerId: adminCustomer.id,
        customerRole: adminCustomer.role,
      } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )

    const query = `query {
      recurringReservations(recurringId: "${recurringId.toString()}") {
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

    expect(res.body.errors).toBeFalsy()
    expect(res.body.data.recurringReservations.length).toBe(4)
  })

  it('should throw an NotAuthenticated if no access token is provided', async () => {
    const query = `query {
      recurringReservations(recurringId: "${recurringId.toString()}") {
        id
        recurringId
        name
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('NOT_AUTHENTICATED')
  })

  it('should throw an NotAuthenticated if the access token is invalid', async () => {
    const query = `query {
      recurringReservations(recurringId: "${recurringId.toString()}") {
        id
        recurringId
        name
      }
    }`

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Authorization', `Bearer ${TextUtils.generateRandomCharacters()}`)
      .expect(200)

    expect(res.body.errors[0].extensions.code).toBe('NOT_AUTHENTICATED')
  })

  it(`should throw a GraphQL validation error if the 'recurringId' property is not provided`, async () => {
    const query = `query {
      recurringReservations(futureOnly: true) {
        id
        recurringId
        name
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
  })
})
