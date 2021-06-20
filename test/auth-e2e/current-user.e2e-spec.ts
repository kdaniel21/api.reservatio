import supertest from 'supertest'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { AuthModule } from '@auth/auth.module'
import { JwtPayload } from '@auth/services/access-token/dto/jwt-payload.interface'
import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { PrismaClient, User } from '@prisma/client'
import { applyMiddleware } from 'src/apply-middleware'
import clearAllData from 'test/setup/clear-all-data'
import { TextUtils } from '@common/utils/text-utils'

describe('CurrentUser E2E', () => {
  let app: INestApplication
  let request: supertest.SuperTest<supertest.Test>
  let prisma: PrismaClient
  let config: ConfigService

  let userRecord: User
  let accessToken: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule] }).compile()
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

    userRecord = await prisma.user.create({
      data: {
        email: 'foo@bar.com',
        password: await bcrypt.hash('password', config.get<number>('auth.bcrypt_salt_rounds')),
        isEmailConfirmed: true,
      },
    })

    accessToken = jwt.sign(
      { userId: userRecord.id, email: userRecord.email } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )
  })

  it('should return the authenticated user', async () => {
    const query = `query {
      currentUser {
        id
        email
        isEmailConfirmed
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.currentUser.id).toBe(userRecord.id)
    expect(res.body.data.currentUser.email).toBe(userRecord.email)
    expect(res.body.data.currentUser.isEmailConfirmed).toBe(userRecord.isEmailConfirmed)
  })

  it('should return the customer profile of the user', async () => {
    const customer = await prisma.customer.create({
      data: { name: 'Test Name', userId: userRecord.id },
    })
    const query = `query {
      currentUser {
        id
        email
        isEmailConfirmed
        customer {
          id
          name
        }
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.currentUser.id).toBe(userRecord.id)
    expect(res.body.data.currentUser.customer).toBeTruthy()
    expect(res.body.data.currentUser.customer.id).toBe(customer.id)
    expect(res.body.data.currentUser.customer.name).toBe(customer.name)
  })

  it('should throw an NotAuthenticated error if no access token is provided', async () => {
    const query = `query {
      currentUser {
        id
        email
        isEmailConfirmed
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('NOT_AUTHENTICATED')
  })

  it('should throw a NotAuthenticated error if the access token is valid but the user does not exist', async () => {
    const validAccessToken = jwt.sign(
      {
        email: 'invalid@bar.com',
        userId: TextUtils.generateRandomCharacters(20),
      } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )
    const query = `query {
      currentUser {
        id
        email
        isEmailConfirmed
      }
    }`

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Authorization', `Bearer ${validAccessToken}`)
      .expect(200)

    expect(res.body.errors[0].extensions.code).toBe('NOT_AUTHENTICATED')
  })

  it('should throw a NotAuthenticated error if an invalid access token is provided', async () => {
    const query = `query {
      currentUser {
        id
        email
        isEmailConfirmed
      }
    }`

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Authorization', `Bearer ${TextUtils.generateRandomCharacters()}`)
      .expect(200)

    expect(res.body.errors[0].extensions.code).toBe('NOT_AUTHENTICATED')
  })
})
