import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient, User } from '@prisma/client'
import { TextUtils } from 'src/common/utils/text-utils'
import { AuthModule } from 'src/modules/auth/auth.module'
import supertest from 'supertest'
import clearAllData from '../setup/clear-all-data'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { ConfigService } from '@nestjs/config'
import { JwtPayload } from 'src/modules/auth/services/access-token/dto/jwt-payload.interface'
import { extractCookies } from 'test/setup/extract-cookies'
import crypto from 'crypto'
import { addDays } from 'date-fns'
import { CommonModule } from 'src/common/common.module'
import { applyMiddleware } from 'src/apply-middleware'

describe('Login E2E', () => {
  let app: INestApplication
  let request: supertest.SuperTest<supertest.Test>
  let prisma: PrismaClient
  let config: ConfigService

  let userRecord: User

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule, CommonModule] }).compile()
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
  })

  it.skip('should login with the correct credentials and return the user', async () => {
    const query = `mutation {
      login(
        email: "foo@bar.com",
        password: "password",
      ) {
        user {
          id
          email
        }
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.data.login.user.id).toBeTruthy()
    expect(res.body.data.login.user.email).toBe('foo@bar.com')
  })

  it('should login with the correct credentials and return a valid access token', async () => {
    const query = `mutation {
      login(
        email: "foo@bar.com",
        password: "password",
      ) {
        accessToken
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.data.login.accessToken).toBeTruthy()
    const jwtPayload = jwt.verify(res.body.data.login.accessToken, config.get<string>('auth.jwt_secret')) as JwtPayload
    expect(jwtPayload.email).toBe('foo@bar.com')
    expect(jwtPayload.userId).toBe(userRecord.id)
  })

  it('should login with the correct credentials, generate and return a valid refresh token', async () => {
    const query = `mutation {
      login(
        email: "foo@bar.com",
        password: "password",
      ) {
        refreshToken
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.data.login.refreshToken).toBeTruthy()
    const hashedToken = TextUtils.hashText(res.body.data.login.refreshToken)
    const refreshTokenRecord = await prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    })
    expect(refreshTokenRecord).toBeTruthy()
    expect(refreshTokenRecord.user.id).toBe(userRecord.id)
    expect(refreshTokenRecord.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('should login with the correct credentials and set the refresh token as an http-only cookie', async () => {
    const query = `mutation {
      login(
        email: "foo@bar.com",
        password: "password",
      ) {
        refreshToken
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    const plainRefreshToken = res.body.data.login.refreshToken
    const refreshTokenRecord = await prisma.refreshToken.findFirst({ where: { user: { email: 'foo@bar.com' } } })
    const cookies = extractCookies(res.headers)
    const refreshTokenCookie = cookies['refresh-token']
    expect(refreshTokenCookie.value).toBe(plainRefreshToken)
    expect(refreshTokenCookie.flags['httponly']).toBeTruthy()
    const expirationThreshold = 30 * 1000
    const expirationDays = config.get<number>('auth.refresh_token_expiration_days')
    const expectedExpiration = addDays(Date.now(), expirationDays).getTime()
    const cookieExpiration = new Date(refreshTokenCookie.flags['expires']).getTime()
    expect(cookieExpiration).toBeGreaterThan(expectedExpiration - expirationThreshold)
    expect(cookieExpiration).toBeLessThan(expectedExpiration + expirationThreshold)
    expect(crypto.createHash('sha256').update(refreshTokenCookie.value).digest('hex').toString()).toBe(
      refreshTokenRecord.token,
    )
  })

  it('should throw an InvalidCredentials error if the email address is invalid', async () => {
    const query = `mutation {
      login(
        email: "foo1@bar.com",
        password: "password",
      ) {
        refreshToken
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('INVALID_CREDENTIALS')
    const numOfUserRefreshTokens = await prisma.refreshToken.count({ where: { userId: userRecord.id } })
    expect(numOfUserRefreshTokens).toBe(0)
  })

  it('should throw an InvalidCredentials error if the password is invalid', async () => {
    const query = `mutation {
      login(
        email: "foo@bar.com",
        password: "password12",
      ) {
        refreshToken
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('INVALID_CREDENTIALS')
    const numOfUserRefreshTokens = await prisma.refreshToken.count({ where: { userId: userRecord.id } })
    expect(numOfUserRefreshTokens).toBe(0)
  })

  it('should throw an EmailNotConfirmed if the email address has not been confirmed', async () => {
    await prisma.user.update({ where: { id: userRecord.id }, data: { isEmailConfirmed: false } })
    const query = `mutation {
      login(
        email: "foo@bar.com",
        password: "password",
      ) {
        refreshToken
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('EMAIL_NOT_CONFIRMED')
    const numOfUserRefreshTokens = await prisma.refreshToken.count({ where: { userId: userRecord.id } })
    expect(numOfUserRefreshTokens).toBe(0)
  })
})
