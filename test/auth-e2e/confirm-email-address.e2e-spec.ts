import supertest from 'supertest'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { AuthModule } from '@auth/auth.module'
import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { PrismaClient, User } from '@prisma/client'
import { applyMiddleware } from 'src/apply-middleware'
import clearAllData from 'test/setup/clear-all-data'
import { TextUtils } from '@common/utils/text-utils'

describe('ConfirmEmail E2E', () => {
  let app: INestApplication
  let request: supertest.SuperTest<supertest.Test>
  let prisma: PrismaClient
  let config: ConfigService

  let userRecord: User
  let confirmationToken: string

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

    confirmationToken = crypto.randomBytes(20).toString('hex')
    userRecord = await prisma.user.create({
      data: {
        email: 'foo@bar.com',
        password: await bcrypt.hash('password', config.get<number>('auth.bcrypt_salt_rounds')),
        isEmailConfirmed: false,
        emailConfirmationToken: crypto.createHash('sha256').update(confirmationToken).digest('hex').toString(),
      },
    })
  })

  it(`should set the 'isEmailConfirmed' property to true`, async () => {
    const query = `mutation {
      confirmEmailAddress(token: "${confirmationToken}") {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query })

    expect(res.body.data.confirmEmailAddress.message).toBeTruthy()
    const user = await prisma.user.findUnique({ where: { id: userRecord.id } })
    expect(user.isEmailConfirmed).toBe(true)
  })

  it(`should remove the 'emailConfirmationToken' from the database`, async () => {
    const query = `mutation {
      confirmEmailAddress(token: "${confirmationToken}") {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.data.confirmEmailAddress.message).toBeTruthy()
    const user = await prisma.user.findUnique({ where: { id: userRecord.id } })
    expect(user.emailConfirmationToken).toBeFalsy()
  })

  it('should throw an InvalidEmailConfirmationTokenError if the token is not valid', async () => {
    const query = `mutation {
      confirmEmailAddress(token: "${TextUtils.generateRandomCharacters()}") {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('INVALID_EMAIL_CONFIRMATION_TOKEN')
    const user = await prisma.user.findUnique({ where: { id: userRecord.id } })
    expect(user.isEmailConfirmed).toBe(false)
    expect(user.emailConfirmationToken).toBeTruthy()
  })

  it('should throw a GraphQL validation error if no token is provided', async () => {
    const query = `mutation {
      confirmEmailAddress() {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_PARSE_FAILED')
    const user = await prisma.user.findUnique({ where: { id: userRecord.id } })
    expect(user.isEmailConfirmed).toBe(false)
    expect(user.emailConfirmationToken).toBeTruthy()
  })
})
