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
import { extractCookies } from 'test/setup/extract-cookies'

describe('Logout E2E', () => {
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
        token: crypto.createHash('sha256').update(refreshToken).digest('hex').toString(),
        expiresAt: new Date(Date.now() + 60 * 1000),
        userId: userRecord.id,
      },
    })

    accessToken = jwt.sign(
      { userId: userRecord.id, email: userRecord.email } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )
  })

  it('should get the refresh token from the cookie and remove it from the database', async () => {
    const query = `
      mutation {
        logout {
          message
        }
      }
    `

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Cookie', `refresh-token=${refreshToken}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)

    expect(res.body.data.logout.message).toBeTruthy()
    const numOfRefreshTokens = await prisma.refreshToken.count()
    expect(numOfRefreshTokens).toBe(0)
  })

  it('should get the refresh token from the input and remove it from the database', async () => {
    const query = `
      mutation {
        logout(refreshToken: "${refreshToken}") {
          message
        }
      }
    `

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.logout.message).toBeTruthy()
    const numOfRefreshTokens = await prisma.refreshToken.count()
    expect(numOfRefreshTokens).toBe(0)
  })

  it('should prefer the refresh token in the input over the refresh token in the cookie', async () => {
    const query = `
      mutation {
        logout(refreshToken: "${refreshToken}") {
          message
        }
      }
    `

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Cookie', `refresh-token=${TextUtils.generateRandomCharacters()}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)

    expect(res.body.data.logout.message).toBeTruthy()
    const numOfRefreshTokens = await prisma.refreshToken.count()
    expect(numOfRefreshTokens).toBe(0)
  })

  it('should remove the refresh token cookie', async () => {
    const query = `
      mutation {
        logout {
          message
        }
      }
    `

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Cookie', `refresh-token=${refreshToken}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)

    expect(res.body.data.logout.message).toBeTruthy()
    const cookies = extractCookies(res.headers)
    expect(cookies['refresh-token']).toBeFalsy()
  })

  it('should throw an InvalidRefreshTokenError if neither the input nor the cookie contains the refresh token', async () => {
    const query = `
      mutation {
        logout {
          message
        }
      }
    `

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('INVALID_REFRESH_TOKEN')
    const numOfRefreshTokens = await prisma.refreshToken.count()
    expect(numOfRefreshTokens).toBe(1)
  })

  it('should not throw any errors if no access token is provided', async () => {
    const query = `
      mutation {
        logout {
          message
        }
      }
    `

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Cookie', `refresh-token=${refreshToken}`)
      .expect(200)

    expect(res.body.data.logout.message).toBeTruthy()
  })
})
