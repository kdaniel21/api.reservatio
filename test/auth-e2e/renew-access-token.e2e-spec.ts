import supertest from 'supertest'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { AuthModule } from '@auth/auth.module'
import { JwtPayload } from '@auth/services/access-token/dto/jwt-payload.interface'
import { CommonModule } from '@common/common.module'
import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { PrismaClient, RefreshToken, User } from '@prisma/client'
import { applyMiddleware } from 'src/apply-middleware'
import clearAllData from 'test/setup/clear-all-data'
import { TextUtils } from '@common/utils/text-utils'

describe('RefreshAccessToken E2E', () => {
  let app: INestApplication
  let request: supertest.SuperTest<supertest.Test>
  let prisma: PrismaClient
  let config: ConfigService

  let userRecord: User
  let refreshToken: string
  let accessToken: string
  let refreshTokenRecord: RefreshToken

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

    refreshToken = crypto.randomBytes(20).toString('hex')
    refreshTokenRecord = await prisma.refreshToken.create({
      data: {
        expiresAt: new Date(Date.now() + 10 * 10 * 1000),
        token: crypto.createHash('sha256').update(refreshToken).digest('hex').toString(),
        userId: userRecord.id,
      },
    })

    accessToken = jwt.sign(
      { userId: userRecord.id, email: userRecord.email } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )

    jest.clearAllMocks()
  })

  it('should get the refresh token from the cookie and return a valid access token', async () => {
    const query = `query {
      renewAccessToken {
        accessToken
      }
    }`

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Cookie', `refresh-token=${refreshToken}`)
      .expect(200)

    expect(res.body.data.renewAccessToken.accessToken).toBeTruthy()
    const accessTokenPayload = jwt.verify(
      res.body.data.renewAccessToken.accessToken,
      config.get<string>('auth.jwt_secret'),
    ) as JwtPayload
    expect(accessTokenPayload.email).toBe(userRecord.email)
    expect(accessTokenPayload.userId).toBe(userRecord.id)
  })

  it('should get the refresh token from the input and return a valid access token', async () => {
    const query = `query {
      renewAccessToken(refreshToken: "${refreshToken}") {
        accessToken
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.data.renewAccessToken.accessToken).toBeTruthy()
    const accessTokenPayload = jwt.verify(
      res.body.data.renewAccessToken.accessToken,
      config.get<string>('auth.jwt_secret'),
    ) as JwtPayload
    expect(accessTokenPayload.email).toBe(userRecord.email)
    expect(accessTokenPayload.userId).toBe(userRecord.id)
  })

  it('should prefer the token provided via input over the one stored as a cookie', async () => {
    const expiredRefreshToken = crypto.randomBytes(20).toString('hex')
    await prisma.refreshToken.create({
      data: {
        expiresAt: new Date(Date.now() - 10 * 10 * 1000),
        token: crypto.createHash('sha256').update(expiredRefreshToken).digest('hex').toString(),
        userId: userRecord.id,
      },
    })
    const query = `query {
      renewAccessToken(refreshToken: "${refreshToken}") {
        accessToken
      }
    }`

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Cookie', `refresh-token=${expiredRefreshToken}`)
      .expect(200)

    expect(res.body.data.renewAccessToken.accessToken).toBeTruthy()
    const accessTokenPayload = jwt.verify(
      res.body.data.renewAccessToken.accessToken,
      config.get<string>('auth.jwt_secret'),
    ) as JwtPayload
    expect(accessTokenPayload.email).toBe(userRecord.email)
    expect(accessTokenPayload.userId).toBe(userRecord.id)
  })

  it('should throw an InvalidRefreshToken error if no refresh token is provided', async () => {
    jest.spyOn(jwt as any, 'sign')
    const query = `query {
      renewAccessToken {
        accessToken
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('INVALID_REFRESH_TOKEN')
    expect(jwt.sign).not.toBeCalled()
  })

  it('should throw an InvalidRefreshToken error if an invalid refresh token is provided', async () => {
    jest.spyOn(jwt as any, 'sign')
    const query = `query {
      renewAccessToken(refreshToken: "${TextUtils.generateRandomCharacters(20)}") {
        accessToken
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('INVALID_REFRESH_TOKEN')
    expect(jwt.sign).not.toBeCalled()
  })

  it('should throw an InvalidRefreshToken error if an expired refresh token is provided via input', async () => {
    jest.spyOn(jwt as any, 'sign')
    const expiredRefreshToken = crypto.randomBytes(20).toString('hex')
    await prisma.refreshToken.create({
      data: {
        expiresAt: new Date(Date.now() - 10 * 10 * 1000),
        token: crypto.createHash('sha256').update(expiredRefreshToken).digest('hex').toString(),
        userId: userRecord.id,
      },
    })
    const query = `query {
      renewAccessToken(refreshToken: "${expiredRefreshToken}") {
        accessToken
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('INVALID_REFRESH_TOKEN')
    expect(jwt.sign).not.toBeCalled()
  })

  it('should throw an InvalidRefreshToken error if an expired refresh token is provided via cookie', async () => {
    jest.spyOn(jwt as any, 'sign')
    const expiredRefreshToken = crypto.randomBytes(20).toString('hex')
    await prisma.refreshToken.create({
      data: {
        expiresAt: new Date(Date.now() - 10 * 10 * 1000),
        token: crypto.createHash('sha256').update(expiredRefreshToken).digest('hex').toString(),
        userId: userRecord.id,
      },
    })
    const query = `query {
      renewAccessToken {
        accessToken
      }
    }`

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Cookie', `refresh-token=${expiredRefreshToken}`)
      .expect(200)

    expect(res.body.errors[0].extensions.code).toBe('INVALID_REFRESH_TOKEN')
    expect(jwt.sign).not.toBeCalled()
  })
})
