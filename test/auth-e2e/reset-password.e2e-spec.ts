import supertest from 'supertest'
import bcrypt from 'bcrypt'
import { AuthModule } from '@auth/auth.module'
import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { PrismaClient, User } from '@prisma/client'
import { applyMiddleware } from 'src/apply-middleware'
import clearAllData from 'test/setup/clear-all-data'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PasswordResetCreatedEvent } from '@auth/events/password-reset-created/password-reset-created.event'
import { PasswordResetService } from '@auth/services/password-reset/password-reset.service'
import { addHours } from 'date-fns'
import { MailerService } from '@mailer/mailer.service'
import { PasswordResetTemplate } from '@mailer/templates/password-reset/password-reset.template'

describe('ResetPassword E2E', () => {
  let app: INestApplication
  let request: supertest.SuperTest<supertest.Test>
  let prisma: PrismaClient
  let config: ConfigService

  let userRecord: User

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

    jest.clearAllMocks()
  })

  it('should generate a password reset token and emit PasswordResetCreatedEvent event if the user exists', async () => {
    jest.spyOn(EventEmitter2.prototype, 'emit')
    const query = `mutation {
      resetPassword(email: "${userRecord.email}") {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.data.resetPassword.message).toBeTruthy()
    expect(EventEmitter2.prototype.emit).toHaveBeenCalledTimes(1)
    expect(EventEmitter2.prototype.emit).toHaveBeenCalledWith(
      PasswordResetCreatedEvent.name,
      expect.objectContaining({ props: { user: userRecord, passwordResetToken: expect.any(String) } }),
    )
  })

  it('should send an email with the token to the email address of the user', async () => {
    jest.spyOn(MailerService.prototype, 'send' as keyof MailerService).mockResolvedValue(void 0)
    const query = `mutation {
      resetPassword(email: "${userRecord.email}") {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.data.resetPassword.message).toBeTruthy()
    expect(MailerService.prototype['send']).toHaveBeenCalledTimes(1)
    expect(MailerService.prototype['send']).toHaveBeenCalledWith(PasswordResetTemplate, userRecord.email, {
      passwordResetToken: expect.any(String),
      user: userRecord,
    })
  })

  it('should persist the generated token to the database', async () => {
    const query = `mutation {
      resetPassword(email: "${userRecord.email}") {
        message
      }
    }`

    await request.post('/graphql').send({ query }).expect(200)

    const user = await prisma.user.findUnique({ where: { email: userRecord.email } })
    expect(user.passwordResetToken).toBeTruthy()
  })

  it('should persist an expiration date correctly', async () => {
    const query = `mutation {
      resetPassword(email: "${userRecord.email}") {
        message
      }
    }`

    await request.post('/graphql').send({ query }).expect(200)

    const user = await prisma.user.findUnique({ where: { email: userRecord.email } })
    expect(user.passwordResetTokenExpiresAt).toBeTruthy()
    const expirationHours = config.get<number>('auth.password_reset_token_expiration_hours')
    const estimatedExpirationTime = addHours(new Date(), expirationHours).getTime()
    const expirationThreshold = 30 * 1000
    const expirationTime = new Date(user.passwordResetTokenExpiresAt).getTime()
    expect(expirationTime).toBeGreaterThan(estimatedExpirationTime - expirationThreshold)
    expect(expirationTime).toBeLessThan(estimatedExpirationTime + expirationThreshold)
  })

  it('should return a success message if no user is registered with given email address', async () => {
    const query = `mutation {
      resetPassword(email: "invalid@email.com") {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.data.resetPassword.message).toBeTruthy()
  })

  it('should throw a GraphQL validation error if no email is provided', async () => {
    const query = `mutation {
      resetPassword {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
  })

  it('should throw a validation error if an invalid email is provided', async () => {
    jest.spyOn(PasswordResetService.prototype, 'createPasswordResetToken')
    const query = `mutation {
      resetPassword(email: "foo") {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(PasswordResetService.prototype.createPasswordResetToken).not.toHaveBeenCalled()
  })

  it('should throw an EmailNotConfirmed if the email address is not confirmed yet', async () => {
    await prisma.user.update({ where: { id: userRecord.id }, data: { isEmailConfirmed: false } })
    const query = `mutation {
      resetPassword(email: "${userRecord.email}") {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('EMAIL_NOT_CONFIRMED')
    const user = await prisma.user.findUnique({ where: { id: userRecord.id } })
    expect(user.passwordResetToken).toBeFalsy()
    expect(user.passwordResetTokenExpiresAt).toBeFalsy()
  })
})
