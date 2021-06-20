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

describe('AreTimesAvailable Integration', () => {
  let app: INestApplication
  let request: supertest.SuperTest<supertest.Test>
  let prisma: PrismaClient
  let config: ConfigService

  let user: User
  let customer: Customer
  let accessToken: string
  let reservations: Partial<Reservation>[]

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

    advanceTo('2021-05-03 10:00')

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

    reservations = [
      {
        id: TextUtils.generateUuid(),
        customerId: customer.id,
        name: 'Single Reservation 1',
        startTime: new Date('2021-05-04 8:00'),
        endTime: new Date('2021-05-04 10:00'),
        tableTennis: true,
      },
      {
        id: TextUtils.generateUuid(),
        customerId: customer.id,
        name: 'Single Reservation 2',
        startTime: new Date('2021-05-04 12:00'),
        endTime: new Date('2021-05-04 14:00'),
        tableTennis: true,
      },
      {
        id: TextUtils.generateUuid(),
        customerId: customer.id,
        name: 'Single Reservation For Different Place 1',
        startTime: new Date('2021-05-04 20:00'),
        endTime: new Date('2021-05-04 21:00'),
        badminton: true,
      },
      {
        id: TextUtils.generateUuid(),
        customerId: customer.id,
        name: 'Double Reservation 1',
        startTime: new Date('2021-05-04 16:00'),
        endTime: new Date('2021-05-04 17:00'),
        tableTennis: true,
        badminton: true,
      },
    ]
    await prisma.reservation.createMany({
      data: [...(reservations as Prisma.ReservationCreateManyInput[])],
    })
    accessToken = jwt.sign(
      { userId: user.id, email: user.email, customerId: customer.id, customerRole: customer.role } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )

    jest.spyOn(TimesAvailabilityService.prototype, 'areTimesAvailable')

    jest.clearAllMocks()
  })

  it('should return true if there are no other reservations', async () => {
    await prisma.reservation.deleteMany()
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-03 10:00')}",
            endTime: "${new Date('2021-05-03 12:00')}",
            locations: { tableTennis: true }
          },
          {
            startTime: "${new Date('2021-05-03 14:00')}",
            endTime: "${new Date('2021-05-03 15:00')}",
            locations: { badminton: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(true)
    expect(res.body.data.areTimesAvailable[0].startTime).toBe(new Date('2021-05-03 10:00').toJSON())
    expect(res.body.data.areTimesAvailable[0].endTime).toBe(new Date('2021-05-03 12:00').toJSON())
    expect(res.body.data.areTimesAvailable[0].locations.badminton).toBe(false)
    expect(res.body.data.areTimesAvailable[0].locations.tableTennis).toBe(true)
    expect(res.body.data.areTimesAvailable[1].isAvailable).toBe(true)
    expect(res.body.data.areTimesAvailable[1].startTime).toBe(new Date('2021-05-03 14:00').toJSON())
    expect(res.body.data.areTimesAvailable[1].endTime).toBe(new Date('2021-05-03 15:00').toJSON())
    expect(res.body.data.areTimesAvailable[1].locations.badminton).toBe(true)
    expect(res.body.data.areTimesAvailable[1].locations.tableTennis).toBe(false)
  })

  it('should exclude a reservation with a specific ID', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 8:30')}",
            endTime: "${new Date('2021-05-04 9:30')}",
            locations: { tableTennis: true },
            excludedReservation: "${reservations[0].id}"
          }
        ],
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(true)
    expect(res.body.data.areTimesAvailable[0].startTime).toBe(new Date('2021-05-04 8:30').toJSON())
    expect(res.body.data.areTimesAvailable[0].endTime).toBe(new Date('2021-05-04 9:30').toJSON())
    expect(res.body.data.areTimesAvailable[0].locations.badminton).toBe(false)
    expect(res.body.data.areTimesAvailable[0].locations.tableTennis).toBe(true)
  })

  it('should return both true and false if one of the times is not available', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 8:30')}",
            endTime: "${new Date('2021-05-04 9:30')}",
            locations: { tableTennis: true }
          },
          {
            startTime: "${new Date('2021-05-03 14:00')}",
            endTime: "${new Date('2021-05-03 15:00')}",
            locations: { badminton: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(false)
    expect(res.body.data.areTimesAvailable[0].startTime).toBe(new Date('2021-05-04 8:30').toJSON())
    expect(res.body.data.areTimesAvailable[0].endTime).toBe(new Date('2021-05-04 9:30').toJSON())
    expect(res.body.data.areTimesAvailable[0].locations.badminton).toBe(false)
    expect(res.body.data.areTimesAvailable[0].locations.tableTennis).toBe(true)
    expect(res.body.data.areTimesAvailable[1].isAvailable).toBe(true)
    expect(res.body.data.areTimesAvailable[1].startTime).toBe(new Date('2021-05-03 14:00').toJSON())
    expect(res.body.data.areTimesAvailable[1].endTime).toBe(new Date('2021-05-03 15:00').toJSON())
    expect(res.body.data.areTimesAvailable[1].locations.badminton).toBe(true)
    expect(res.body.data.areTimesAvailable[1].locations.tableTennis).toBe(false)
  })

  it('should return true if there are no other reservations for a particular day', async () => {
    await prisma.reservation.deleteMany()
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-05 10:00')}",
            endTime: "${new Date('2021-05-05 13:30')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(true)
  })

  it('should return true if the reservation starts right after the previous ends', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 10:00')}",
            endTime: "${new Date('2021-05-04 11:00')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(true)
  })

  it('should return true if the reservation ends right before the next starts', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 6:00')}",
            endTime: "${new Date('2021-05-04 8:00')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(true)
  })

  it('should return false if an existing reservation starts and ends within the reservation time', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 7:45')}",
            endTime: "${new Date('2021-05-04 10:15')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(false)
  })

  it('should return true if an existing reservation for a different place starts and ends within the reservation time', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 19:45')}",
            endTime: "${new Date('2021-05-04 21:15')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(true)
  })

  it('should return false if an existing single-place reservation starts and ends within the reservation time for both locations', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 19:45')}",
            endTime: "${new Date('2021-05-04 21:15')}",
            locations: { tableTennis: true, badminton: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(false)
  })

  it('should return false if an existing reservation ends within the reservation time', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 9:30')}",
            endTime: "${new Date('2021-05-04 10:30')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(false)
  })

  it('should return false if an existing single-place reservation ends within the reservation time for both locations', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 9:30')}",
            endTime: "${new Date('2021-05-04 10:30')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(false)
  })

  it('should return true if an existing reservation for a different place ends within the reservation time', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 20:30')}",
            endTime: "${new Date('2021-05-04 21:30')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(true)
  })

  it('should return false if an existing reservation starts within the reservation time', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 7:30')}",
            endTime: "${new Date('2021-05-04 8:30')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(false)
  })

  it('should return false if an existing single-place reservation starts within the reservation time for both locations', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 7:30')}",
            endTime: "${new Date('2021-05-04 8:30')}",
            locations: { tableTennis: true, badminton: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(false)
  })

  it('should return true if an existing reservation for a different place starts within the reservation time', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 19:30')}",
            endTime: "${new Date('2021-05-04 20:30')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(true)
  })

  it('should return false if the reservation starts and ends within an existing reservation', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 8:30')}",
            endTime: "${new Date('2021-05-04 9:30')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(false)
  })

  it('should return false if the reservation for both locations starts and ends within an existing reservation for a single place', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 8:30')}",
            endTime: "${new Date('2021-05-04 9:30')}",
            locations: { tableTennis: true, badminton: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(false)
  })

  it('should return true if the reservation starts and ends within an existing reservation for a different place', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 20:15')}",
            endTime: "${new Date('2021-05-04 20:45')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(true)
  })

  it('should return false if the reservation starts and ends exactly at the same time as an existing reservation', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 12:00')}",
            endTime: "${new Date('2021-05-04 14:00')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable[0].isAvailable).toBe(false)
  })

  it('should throw a ValidationError if the requested time span is greater than the allowed maximum', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 10:00')}",
            endTime: "${new Date('2021-05-04 15:00')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(TimesAvailabilityService.prototype.areTimesAvailable).not.toHaveBeenCalled()
  })

  it('should not throw a ValidationError if the requested time span is the same as the allowed maximum', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 10:00')}",
            endTime: "${new Date('2021-05-04 14:00')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable).toBeTruthy()
    expect(res.body.errors).toBeFalsy()
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(1)
  })

  it('should not throw a ValidationError if the requested time span is less than the allowed maximum', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 10:00')}",
            endTime: "${new Date('2021-05-04 14:00')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.areTimesAvailable).toBeTruthy()
    expect(res.body.errors).toBeFalsy()
    expect(TimesAvailabilityService.prototype.areTimesAvailable).toHaveBeenCalledTimes(1)
  })

  it('should throw a ValidationError if both locations are false', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 10:00')}",
            endTime: "${new Date('2021-05-04 14:00')}",
            locations: { tableTennis: false, badminton: false }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(TimesAvailabilityService.prototype.areTimesAvailable).not.toHaveBeenCalled()
  })

  it(`should throw a ValidationError if 'locations' is an empty object`, async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 10:00')}",
            endTime: "${new Date('2021-05-04 14:00')}",
            locations: {}
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(TimesAvailabilityService.prototype.areTimesAvailable).not.toHaveBeenCalled()
  })

  it(`should throw a GraphQL validation error if 'startTime' is not specified`, async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            endTime: "${new Date('2021-05-04 14:00')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    expect(TimesAvailabilityService.prototype.areTimesAvailable).not.toHaveBeenCalled()
  })

  it(`should throw a GraphQL validation error if 'endTime' is not specified`, async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 10:00')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    expect(TimesAvailabilityService.prototype.areTimesAvailable).not.toHaveBeenCalled()
  })

  it(`should throw a GraphQL validation error if 'locations' is not specified`, async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 10:00')}",
            endTime: "${new Date('2021-05-04 14:00')}",
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    expect(TimesAvailabilityService.prototype.areTimesAvailable).not.toHaveBeenCalled()
  })

  it('should throw an NotAuthenticated if no access token is provided', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 10:00')}",
            endTime: "${new Date('2021-05-04 14:00')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('NOT_AUTHENTICATED')
    expect(TimesAvailabilityService.prototype.areTimesAvailable).not.toHaveBeenCalled()
  })

  it('should throw an NotAuthenticated if the provided access token is invalid', async () => {
    const invalidAccessToken = jwt.sign({ userId: user.id, email: user.email } as JwtPayload, 'DefinitelyInvalidSecret')
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-04 10:00')}",
            endTime: "${new Date('2021-05-04 14:00')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', invalidAccessToken).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('NOT_AUTHENTICATED')
    expect(TimesAvailabilityService.prototype.areTimesAvailable).not.toHaveBeenCalled()
  })

  it('should throw a ValidationError if the requested time is in the past', async () => {
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${new Date('2021-05-02 10:00')}",
            endTime: "${new Date('2021-05-02 14:00')}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(TimesAvailabilityService.prototype.areTimesAvailable).not.toHaveBeenCalled()
  })

  it('should throw a ValidationError if the requested time is today but in the past', async () => {
    const startTime = new Date('2021-05-03 8:00')
    const endTime = new Date('2021-05-03 9:00')
    const query = `query {
      areTimesAvailable(
        timeProposals: [
          {
            startTime: "${startTime}",
            endTime: "${endTime}",
            locations: { tableTennis: true }
          }
        ]
      ) {
        startTime
        endTime
        locations {
          tableTennis
          badminton
        }
        isAvailable
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(TimesAvailabilityService.prototype.areTimesAvailable).not.toHaveBeenCalled()
  })
})
