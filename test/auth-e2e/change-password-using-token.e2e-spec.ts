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

describe('ChangePasswordUsingToken E2E', () => {
  let app: INestApplication
  let request: supertest.SuperTest<supertest.Test>
  let prisma: PrismaClient
  let config: ConfigService

  let userRecord: User
  let passwordResetToken: string

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

    passwordResetToken = crypto.randomBytes(20).toString('hex')

    userRecord = await prisma.user.create({
      data: {
        email: 'foo@bar.com',
        password: await bcrypt.hash('password', config.get<number>('auth.bcrypt_salt_rounds')),
        passwordResetToken: crypto.createHash('sha256').update(passwordResetToken).digest('hex').toString(),
        passwordResetTokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        isEmailConfirmed: true,
      },
    })
  })

  it('should persist the new encrypted password to the database', async () => {
    const query = `mutation {
      changePasswordUsingToken(
        passwordResetToken: "${passwordResetToken}",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query })

    expect(res.body.data.changePasswordUsingToken.message).toBeTruthy()
    const user = await prisma.user.findUnique({ where: { id: userRecord.id } })
    expect(user.password).not.toBe(userRecord.password)
    expect(user.password).not.toBe('Th1sIsAG00dPassw0rd')
    const doPasswordsMatch = await bcrypt.compare('Th1sIsAG00dPassw0rd', user.password)
    expect(doPasswordsMatch).toBe(true)
  })

  it(`should set both 'passwordResetToken' and 'passwordResetTokenExpiresAt' to undefined in the database`, async () => {
    const query = `mutation {
      changePasswordUsingToken(
        passwordResetToken: "${passwordResetToken}",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd"
      ) {
        message
      }
    }`

    await request.post('/graphql').send({ query }).expect(200)

    const user = await prisma.user.findUnique({ where: { id: userRecord.id } })
    expect(user.passwordResetToken).toBeFalsy()
    expect(user.passwordResetTokenExpiresAt).toBeFalsy()
  })

  it('should throw a validation error if the password does not meet the criteria', async () => {
    const query = `mutation {
      changePasswordUsingToken(
        passwordResetToken: "${passwordResetToken}",
        password: "weakpassword",
        passwordConfirm: "weakpassword"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    const user = await prisma.user.findUnique({ where: { id: userRecord.id } })
    expect(user.password).toBe(userRecord.password)
    expect(user.passwordResetToken).toBeTruthy()
    expect(user.passwordResetTokenExpiresAt).toBeTruthy()
  })

  it(`should throw a validation error if the 'password' and 'passwordConfirm' do not match`, async () => {
    const query = `mutation {
      changePasswordUsingToken(
        passwordResetToken: "${passwordResetToken}",
        password: "weakpassword",
        passwordConfirm: "differentpassword"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    const user = await prisma.user.findUnique({ where: { id: userRecord.id } })
    expect(user.password).toBe(userRecord.password)
    expect(user.passwordResetToken).toBeTruthy()
    expect(user.passwordResetTokenExpiresAt).toBeTruthy()
  })

  it(`should a GraphQL validation error if 'passwordResetToken' is not provided`, async () => {
    const query = `mutation {
      changePasswordUsingToken(
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
  })

  it(`should a GraphQL validation error if 'password' is not provided`, async () => {
    const query = `mutation {
      changePasswordUsingToken(
        passwordResetToken: "${passwordResetToken}",
        passwordConfirm: "Th1sIsAG00dPassw0rd"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    const user = await prisma.user.findUnique({ where: { id: userRecord.id } })
    expect(user.password).toBe(userRecord.password)
    expect(user.passwordResetToken).toBeTruthy()
    expect(user.passwordResetTokenExpiresAt).toBeTruthy()
  })

  it(`should a GraphQL validation error if 'passwordConfirm' is not provided`, async () => {
    const query = `mutation {
      changePasswordUsingToken(
        passwordResetToken: "${passwordResetToken}",
        password: "Th1sIsAG00dPassw0rd"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    const user = await prisma.user.findUnique({ where: { id: userRecord.id } })
    expect(user.password).toBe(userRecord.password)
    expect(user.passwordResetToken).toBeTruthy()
    expect(user.passwordResetTokenExpiresAt).toBeTruthy()
  })

  it('should throw an InvalidTokenError if the password reset token is invalid', async () => {
    const query = `mutation {
      changePasswordUsingToken(
        passwordResetToken: "${TextUtils.generateRandomCharacters(20)}",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('INVALID_PASSWORD_RESET_TOKEN')
    const user = await prisma.user.findUnique({ where: { id: userRecord.id } })
    expect(user.password).toBe(userRecord.password)
    expect(user.passwordResetToken).toBeTruthy()
    expect(user.passwordResetTokenExpiresAt).toBeTruthy()
  })

  it('should throw an InvalidTokenError if the password reset token is expired', async () => {
    await prisma.user.update({
      where: { id: userRecord.id },
      data: { passwordResetTokenExpiresAt: new Date(Date.now() - 100) },
    })
    const query = `mutation {
      changePasswordUsingToken(
        passwordResetToken: "${passwordResetToken}",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('INVALID_PASSWORD_RESET_TOKEN')
    const user = await prisma.user.findUnique({ where: { id: userRecord.id } })
    expect(user.password).toBe(userRecord.password)
    expect(user.passwordResetToken).toBeTruthy()
    expect(user.passwordResetTokenExpiresAt).toBeTruthy()
  })
})
