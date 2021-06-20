import supertest from 'supertest'
import crypto from 'crypto'
import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { Customer, CustomerRole, PrismaClient, Reservation, User } from '@prisma/client'
import { applyMiddleware } from 'src/apply-middleware'
import clearAllData from 'test/setup/clear-all-data'
import { TextUtils } from '@common/utils/text-utils'
import jwt from 'jsonwebtoken'
import { JwtPayload } from '@auth/services/access-token/dto/jwt-payload.interface'
import { GetReservationService } from 'src/modules/reservation/services/get-reservation/get-reservation.service'
import { ReservationModule } from 'src/modules/reservation/reservation.module'

describe('GetReservation Integration', () => {
  let app: INestApplication
  let request: supertest.SuperTest<supertest.Test>
  let prisma: PrismaClient
  let config: ConfigService

  let user: User
  let customer: Customer
  let accessToken: string

  let adminUser: User
  let adminAccessToken: string

  let reservation: Reservation

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

    user = await prisma.user.create({
      data: {
        email: 'foo@bar.com',
        password: TextUtils.generateRandomCharacters(20),
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
      { userId: user.id, email: user.email, customerRole: customer.role, customerId: customer.id } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )

    adminUser = await prisma.user.create({
      data: {
        email: 'admin@bar.com',
        password: crypto.randomBytes(20).toString('hex'),
        isEmailConfirmed: true,
      },
    })
    await prisma.customer.create({
      data: {
        userId: adminUser.id,
        name: 'Admin Bar',
        role: CustomerRole.ADMIN,
      },
    })
    adminAccessToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )

    reservation = await prisma.reservation.create({
      data: {
        name: 'Reservation',
        startTime: new Date('2021-05-04 10:00:00'),
        endTime: new Date('2021-05-04 12:00:00'),
        badminton: true,
        tableTennis: false,
        customer: { connect: { id: customer.id } },
      },
    })

    jest.spyOn(GetReservationService.prototype, 'getReservationById')

    jest.clearAllMocks()
  })

  it('should get a single reservation that belongs to the user', async () => {
    const query = `query {
      reservation(id: "${reservation.id}") {
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

    expect(res.body.data.reservation.id).toBe(reservation.id)
    expect(res.body.data.reservation.name).toBe(reservation.name)
    expect(res.body.data.reservation.isActive).toBe(reservation.isActive)
    expect(res.body.data.reservation.recurringId).toBeFalsy()
    expect(res.body.data.reservation.startTime).toBe(reservation.startTime.toJSON())
    expect(res.body.data.reservation.endTime).toBe(reservation.endTime.toJSON())
    expect(res.body.data.reservation.locations.tableTennis).toBe(reservation.tableTennis)
    expect(res.body.data.reservation.locations.badminton).toBe(reservation.badminton)
    expect(res.body.data.reservation.customer.name).toBe(customer.name)
    expect(res.body.data.reservation.customer.id).toBe(customer.id)
    expect(res.body.data.reservation.customer.role).toEqualCaseInsensitive(customer.role)
    expect(res.body.data.reservation.customer.user.id).toBe(user.id)
    expect(res.body.data.reservation.customer.user.email).toBe(user.email)
    expect(res.body.data.reservation.createdAt).toBe(reservation.createdAt.toJSON())
    expect(res.body.data.reservation.updatedAt).toBe(reservation.updatedAt.toJSON())
  })

  it('should get a single reservation that does not belong to the user but the user is an admin', async () => {
    const query = `query {
      reservation(id: "${reservation.id}") {
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

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)

    expect(res.body.data.reservation.id).toBe(reservation.id)
    expect(res.body.data.reservation.name).toBe(reservation.name)
    expect(res.body.data.reservation.isActive).toBe(reservation.isActive)
    expect(res.body.data.reservation.recurringId).toBeFalsy()
    expect(res.body.data.reservation.startTime).toBe(reservation.startTime.toJSON())
    expect(res.body.data.reservation.endTime).toBe(reservation.endTime.toJSON())
    expect(res.body.data.reservation.locations.tableTennis).toBe(reservation.tableTennis)
    expect(res.body.data.reservation.locations.badminton).toBe(reservation.badminton)
    expect(res.body.data.reservation.customer.name).toBe(customer.name)
    expect(res.body.data.reservation.customer.id).toBe(customer.id)
    expect(res.body.data.reservation.customer.role).toEqualCaseInsensitive(customer.role)
    expect(res.body.data.reservation.customer.user.id).toBe(user.id)
    expect(res.body.data.reservation.customer.user.email).toBe(user.email)
    expect(res.body.data.reservation.createdAt).toBe(reservation.createdAt.toJSON())
    expect(res.body.data.reservation.updatedAt).toBe(reservation.updatedAt.toJSON())
  })

  it('should throw a ReservationNotFoundError if no reservation exists with given ID', async () => {
    jest.spyOn(GetReservationService.prototype, 'getReservationById')
    const query = `query {
      reservation(id: "${TextUtils.generateRandomCharacters()}") {
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

    expect(res.body.errors[0].extensions.code).toBe('RESERVATION_NOT_FOUND')
    expect(GetReservationService.prototype.getReservationById).toHaveBeenCalledTimes(1)
  })

  it('should throw a ReservationNotAuthorized if the reservation does not belong to the user', async () => {
    const otherUser = await prisma.user.create({
      data: {
        email: 'apple@bar.com',
        password: crypto.randomBytes(20).toString('hex'),
        isEmailConfirmed: true,
      },
    })
    await prisma.customer.create({
      data: {
        userId: otherUser.id,
        name: 'Foo Bar',
      },
    })
    const otherUserAccessToken = jwt.sign(
      { userId: otherUser.id, email: otherUser.email } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )
    const query = `query {
      reservation(id: "${reservation.id}") {
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

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Authorization', `Bearer ${otherUserAccessToken}`)
      .expect(200)

    expect(res.body.errors[0].extensions.code).toBe('RESERVATION_NOT_AUTHORIZED')
  })

  it(`should throw a GraphQL validation error if the 'id' argument is not specified`, async () => {
    const query = `query {
      reservation {
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

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    expect(GetReservationService.prototype.getReservationById).toHaveBeenCalledTimes(0)
  })

  it('should throw an NotAuthenticated if no access token is provided', async () => {
    const query = `query {
      reservation(id: "${reservation.id}") {
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

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('NOT_AUTHENTICATED')
    expect(GetReservationService.prototype.getReservationById).not.toBeCalled()
  })

  it('should throw a NotAuthorizedError if the customer profile does not exist', async () => {
    const userWithoutCustomerProfile = await prisma.user.create({
      data: {
        email: 'other@bar.com',
        password: crypto.randomBytes(20).toString('hex'),
        isEmailConfirmed: true,
      },
    })
    const userWithoutCustomerProfileAccessToken = jwt.sign(
      { userId: userWithoutCustomerProfile.id, email: userWithoutCustomerProfile.email } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )
    const query = `query {
      reservation(id: "${reservation.id}") {
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

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Authorization', `Bearer ${userWithoutCustomerProfileAccessToken}`)
      .expect(200)

    expect(res.body.errors[0].extensions.code).toBe('INVALID_CUSTOMER')
  })
})
