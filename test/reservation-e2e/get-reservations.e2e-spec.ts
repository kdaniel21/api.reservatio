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
import { TextUtils } from '@common/utils/text-utils'
import { PrismaService } from '@common/services/prisma.service'

describe('GetReservation E2E', () => {
  let app: INestApplication
  let request: supertest.SuperTest<supertest.Test>
  let prisma: PrismaClient
  let config: ConfigService
  let prismaService: PrismaService

  let user: User
  let customer: Customer
  let accessToken: string

  let adminUser: User
  let adminCustomer: Customer
  let adminAccessToken: string

  let userWithoutReservations: User
  let customerWithoutReservation: Customer
  let accessTokenWithoutReservation: string

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
    advanceTo('2021-05-03 10:00')
    await clearAllData()

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

    adminUser = await prisma.user.create({
      data: {
        email: 'admin@bar.com',
        password: crypto.randomBytes(20).toString('hex'),
        isEmailConfirmed: true,
      },
    })
    adminCustomer = await prisma.customer.create({
      data: {
        userId: adminUser.id,
        name: 'Admin Bar',
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

    userWithoutReservations = await prisma.user.create({
      data: {
        email: 'baz@bar.com',
        password: crypto.randomBytes(20).toString('hex'),
        isEmailConfirmed: true,
      },
    })
    customerWithoutReservation = await prisma.customer.create({
      data: {
        userId: userWithoutReservations.id,
        name: 'No Reservations',
      },
    })
    accessTokenWithoutReservation = jwt.sign(
      {
        userId: userWithoutReservations.id,
        email: userWithoutReservations.email,
        customerId: customerWithoutReservation.id,
        customerRole: customerWithoutReservation.role,
      } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )

    reservations = [
      {
        id: TextUtils.generateUuid(),
        name: 'This week Reservation 1',
        startTime: new Date('2021-05-04 10:00:00'),
        endTime: new Date('2021-05-04 12:00:00'),
        badminton: true,
        tableTennis: false,
        customerId: customer.id,
        isActive: true,
      },
      {
        id: TextUtils.generateUuid(),
        name: 'This Week Reservation 2',
        startTime: new Date('2021-05-06 16:00:00'),
        endTime: new Date('2021-05-06 17:00:00'),
        badminton: true,
        tableTennis: true,
        customerId: customer.id,
        isActive: true,
      },
      {
        id: TextUtils.generateUuid(),
        name: 'This week Reservation 3',
        startTime: new Date('2021-05-09 20:00:00'),
        endTime: new Date('2021-05-09 22:00:00'),
        badminton: false,
        tableTennis: true,
        customerId: customer.id,
        isActive: true,
      },
      {
        id: TextUtils.generateUuid(),
        name: 'Next Week Reservation 1',
        startTime: new Date('2021-05-11 17:15:00'),
        endTime: new Date('2021-05-11 18:30:00'),
        badminton: false,
        tableTennis: true,
        customerId: customer.id,
        isActive: true,
      },
      {
        id: TextUtils.generateUuid(),
        name: 'Past Week Reservation 1',
        startTime: new Date('2021-05-01 17:15:00'),
        endTime: new Date('2021-05-01 18:30:00'),
        badminton: false,
        tableTennis: true,
        customerId: customer.id,
        isActive: true,
      },
      {
        id: TextUtils.generateUuid(),
        name: 'Past Week Reservation 2 OTHER USER',
        startTime: new Date('2021-05-02 13:15:00'),
        endTime: new Date('2021-05-02 15:30:00'),
        badminton: false,
        tableTennis: true,
        customerId: adminCustomer.id,
        isActive: true,
      },
      {
        id: TextUtils.generateUuid(),
        name: 'This week 4 NOT ACTIVE',
        startTime: new Date('2021-05-04 14:00:00'),
        endTime: new Date('2021-05-04 15:30:00'),
        badminton: false,
        tableTennis: true,
        customerId: customer.id,
        isActive: false,
      },
    ]
    await prisma.reservation.createMany({ data: reservations as Prisma.ReservationCreateManyInput[] })

    jest.spyOn(prismaService.reservation, 'findMany')
    jest.clearAllMocks()
  })

  it('should care only about the date of startDate and endDate and return all reservations for a future week', async () => {
    advanceTo('2021-05-01 11:30')
    const query = `query {
      reservations(
        startDate: "${new Date('2021-05-03 13:00')}",
        endDate: "${new Date('2021-05-09 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.reservations.length).toBe(3)
    const reservationIds = reservations.slice(0, 2).map((reservation) => reservation.id)
    const responseReservationIds = res.body.data.reservations.map((reservation: any) => reservation.id)
    expect(responseReservationIds).toIncludeAllMembers(reservationIds)
    expect(res.body.data.reservations[0].id).toBe(reservations[0].id)
    expect(res.body.data.reservations[0].name).toBe(reservations[0].name)
    expect(res.body.data.reservations[0].isActive).toBe(reservations[0].isActive)
    expect(res.body.data.reservations[0].startTime).toBe(reservations[0].startTime.toJSON())
    expect(res.body.data.reservations[0].endTime).toBe(reservations[0].endTime.toJSON())
    expect(res.body.data.reservations[0].locations.tableTennis).toBe(reservations[0].tableTennis)
    expect(res.body.data.reservations[0].locations.badminton).toBe(reservations[0].badminton)
    expect(res.body.data.reservations[0].customer.name).toBe(customer.name)
    expect(res.body.data.reservations[0].customer.id).toBe(customer.id)
    expect(res.body.data.reservations[0].customer.role).toEqualCaseInsensitive(customer.role)
    expect(res.body.data.reservations[0].customer.user.id).toBe(user.id)
    expect(res.body.data.reservations[0].customer.user.email).toBe(user.email)
  })

  it('should return the reservations only for the coming days for the current week', async () => {
    advanceTo('2021-05-07 09:00')
    const query = `query {
      reservations(
        startDate: "${new Date('2021-05-03 13:00')}",
        endDate: "${new Date('2021-05-09 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Authorization', `Bearer ${accessTokenWithoutReservation}`)
      .expect(200)

    expect(res.body.data.reservations.length).toBe(1)
    expect(res.body.data.reservations[0].id).toBe(reservations[2].id)
  })

  it('should return the reservations only for the coming days for the current week and the ones that were made by the user', async () => {
    advanceTo('2021-05-07 09:00')
    const query = `query {
      reservations(
        startDate: "${new Date('2021-05-03 13:00')}",
        endDate: "${new Date('2021-05-09 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.reservations.length).toBe(3)
    const responseReservationIds = res.body.data.reservations.map((reservation: any) => reservation.id)
    const reservationIds = reservations.slice(0, 2).map((reservation) => reservation.id)
    expect(responseReservationIds).toIncludeAllMembers(reservationIds)
  })

  it('should return reservations for a single day', async () => {
    const query = `query {
      reservations(
        startDate: "${new Date('2021-05-06 13:42')}",
        endDate: "${new Date('2021-05-06 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.reservations.length).toBe(1)
    expect(res.body.data.reservations[0].id).toBe(reservations[1].id)
  })

  it('should throw a ValidationError if the time period is more than a week', async () => {
    const query = `query {
      reservations(
        startDate: "${new Date('2021-05-06 13:42')}",
        endDate: "${new Date('2021-05-14 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(prismaService.reservation.findMany).not.toBeCalled()
  })

  it('should return only the reservations that belongs to the user if a past week is requested', async () => {
    const query = `query {
      reservations(
        startDate: "${new Date('2021-04-26 13:42')}",
        endDate: "${new Date('2021-05-02 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.reservations.length).toBe(1)
    expect(res.body.data.reservations[0].id).toBe(reservations[4].id)
  })

  it('should return nothing for a past week if the user does not have any reservations', async () => {
    const query = `query {
      reservations(
        startDate: "${new Date('2021-04-26 13:42')}",
        endDate: "${new Date('2021-05-02 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Authorization', `Bearer ${accessTokenWithoutReservation}`)
      .expect(200)

    expect(res.body.data.reservations.length).toBe(0)
  })

  it('should return all reservations for an admin for the current week', async () => {
    advanceTo('2021-05-07 17:32')
    const query = `query {
      reservations(
        startDate: "${new Date('2021-05-03 13:42')}",
        endDate: "${new Date('2021-05-09 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.reservations.length).toBe(3)
    const reservationIds = reservations.slice(0, 2).map((reservation) => reservation.id)
    const responseReservationIds = res.body.data.reservations.map((reservation: any) => reservation.id)
    expect(responseReservationIds).toIncludeAllMembers(reservationIds)
  })

  it('should return all reservations for an admin for a future week', async () => {
    const query = `query {
      reservations(
        startDate: "${new Date('2021-05-03 13:42')}",
        endDate: "${new Date('2021-05-09 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.reservations.length).toBe(3)
    const reservationIds = reservations.slice(0, 2).map((reservation) => reservation.id)
    const responseReservationIds = res.body.data.reservations.map((reservation: any) => reservation.id)
    expect(responseReservationIds).toIncludeAllMembers(reservationIds)
  })

  it('should return all reservations for an admin for a past week', async () => {
    advanceTo('2021-05-12 16:42')
    const query = `query {
      reservations(
        startDate: "${new Date('2021-05-03 13:42')}",
        endDate: "${new Date('2021-05-09 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.reservations.length).toBe(3)
    const reservationIds = reservations.slice(0, 2).map((reservation) => reservation.id)
    const responseReservationIds = res.body.data.reservations.map((reservation: any) => reservation.id)
    expect(responseReservationIds).toIncludeAllMembers(reservationIds)
  })

  it(`should throw a GraphQL validation error if the 'startDate' argument is not specified`, async () => {
    const query = `query {
      reservations(
        endDate: "${new Date('2021-05-09 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
  })

  it(`should throw a GraphQL validation error if the 'endDate' argument is not specified`, async () => {
    const query = `query {
      reservations(
        startDate: "${new Date('2021-05-09 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    expect(prismaService.reservation.findMany).not.toBeCalled()
  })

  it('should throw a NotAuthenticated if no access token is provided', async () => {
    const query = `query {
      reservations(
        startDate: "${new Date('2021-05-03 13:42')}",
        endDate: "${new Date('2021-05-09 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('NOT_AUTHENTICATED')
    expect(prismaService.reservation.findMany).not.toBeCalled()
  })

  it('should return an empty array if no reservations are made', async () => {
    await prisma.reservation.deleteMany()
    const query = `query {
      reservations(
        startDate: "${new Date('2021-05-03 13:42')}",
        endDate: "${new Date('2021-05-09 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.reservations.length).toBe(0)
  })

  it(`should not return non-active reservations for a past week for a user`, async () => {
    advanceTo('2021-05-14 13:32')
    const query = `query {
      reservations(
        startDate: "${new Date('2021-05-03 13:00')}",
        endDate: "${new Date('2021-05-09 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.reservations.length).toBe(3)
    const reservationIds = reservations.slice(0, 2).map((reservation) => reservation.id)
    const responseReservationIds = res.body.data.reservations.map((reservation: any) => reservation.id)
    expect(responseReservationIds).toIncludeAllMembers(reservationIds)
  })

  it(`should not return non-active reservations for the current week for a user`, async () => {
    const query = `query {
      reservations(
        startDate: "${new Date('2021-05-03 13:00')}",
        endDate: "${new Date('2021-05-09 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.reservations.length).toBe(3)
    const reservationIds = reservations.slice(0, 2).map((reservation) => reservation.id)
    const responseReservationIds = res.body.data.reservations.map((reservation: any) => reservation.id)
    expect(responseReservationIds).toIncludeAllMembers(reservationIds)
  })

  it(`should not return non-active reservations for a future week for a user`, async () => {
    advanceTo('2021-05-01 19:41')
    const query = `query {
      reservations(
        startDate: "${new Date('2021-05-03 13:00')}",
        endDate: "${new Date('2021-05-09 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.reservations.length).toBe(3)
    const reservationIds = reservations.slice(0, 2).map((reservation) => reservation.id)
    const responseReservationIds = res.body.data.reservations.map((reservation: any) => reservation.id)
    expect(responseReservationIds).toIncludeAllMembers(reservationIds)
  })

  it(`should return non-active reservations for a past week for an admin`, async () => {
    advanceTo('2021-05-14 13:32')
    const query = `query {
      reservations(
        startDate: "${new Date('2021-05-03 13:00')}",
        endDate: "${new Date('2021-05-09 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)

    expect(res.body.data.reservations.length).toBe(4)
    const reservationIds = reservations.slice(0, 2).map((reservation) => reservation.id)
    const responseReservationIds = res.body.data.reservations.map((reservation: any) => reservation.id)
    expect(responseReservationIds).toIncludeAllMembers([...reservationIds, reservations[6].id])
  })

  it(`should return non-active reservations for the current week for an admin`, async () => {
    const query = `query {
      reservations(
        startDate: "${new Date('2021-05-03 13:00')}",
        endDate: "${new Date('2021-05-09 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)

    expect(res.body.data.reservations.length).toBe(4)
    const reservationIds = reservations.slice(0, 2).map((reservation) => reservation.id)
    const responseReservationIds = res.body.data.reservations.map((reservation: any) => reservation.id)
    expect(responseReservationIds).toIncludeAllMembers([...reservationIds, reservations[6].id])
  })

  it(`should return non-active reservations for a future week for an admin`, async () => {
    advanceTo('2021-05-01 10:10')
    const query = `query {
      reservations(
        startDate: "${new Date('2021-05-03 13:00')}",
        endDate: "${new Date('2021-05-09 12:34')}"
      ) {
        id
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
      }
    }`

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)

    expect(res.body.data.reservations.length).toBe(4)
    const reservationIds = reservations.slice(0, 2).map((reservation) => reservation.id)
    const responseReservationIds = res.body.data.reservations.map((reservation: any) => reservation.id)
    expect(responseReservationIds).toIncludeAllMembers([...reservationIds, reservations[6].id])
  })
})
