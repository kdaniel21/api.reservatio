import supertest from 'supertest'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { AuthModule } from '@auth/auth.module'
import { CommonModule } from '@common/common.module'
import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { PrismaClient, User } from '@prisma/client'
import { applyMiddleware } from 'src/apply-middleware'
import clearAllData from 'test/setup/clear-all-data'
import { MailerService } from '@mailer/mailer.service'
import { ConfirmEmailTemplate } from '@mailer/templates/confirm-email/confirm-email.template'
import { TextUtils } from '@common/utils/text-utils'
import { mocked } from 'ts-jest/utils'

describe('Send email confirmation', () => {
  let app: INestApplication
  let request: supertest.SuperTest<supertest.Test>
  let prisma: PrismaClient
  let config: ConfigService

  let userRecord: User

  const mailerServiceMock = MailerService.prototype

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
        isEmailConfirmed: false,
        emailConfirmationToken: crypto.randomBytes(20).toString('hex'),
      },
    })

    jest.clearAllMocks()

    jest.spyOn(MailerService.prototype, 'send' as keyof MailerService).mockResolvedValue(void 0)
  })

  it('should send re-send the email confirmation email to a registered address', async () => {
    const query = `mutation {
      sendEmailConfirmation(email: "${userRecord.email}") {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.data.sendEmailConfirmation.message).toBeTruthy()
    const user = await prisma.user.findUnique({ where: { id: userRecord.id } })
    expect(user.emailConfirmationToken).not.toBe(userRecord.emailConfirmationToken)
    expect(mailerServiceMock['send']).toHaveBeenCalledTimes(1)
    const sendToUserArguments = mocked(mailerServiceMock['send']).mock.calls[0]
    expect(sendToUserArguments[0]).toBe(ConfirmEmailTemplate)
    expect(sendToUserArguments[1]).toBe(userRecord.email)
    expect((sendToUserArguments[2] as any).user.id.toString()).toBe(userRecord.id)
  })

  it('should throw a GraphQL validation error if no email address is provided', async () => {
    const query = `mutation {
      sendEmailConfirmation(email: ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_PARSE_FAILED')
    const user = await prisma.user.findUnique({ where: { id: userRecord.id } })
    expect(user.emailConfirmationToken).toBe(userRecord.emailConfirmationToken)
    expect(mailerServiceMock['send']).toHaveBeenCalledTimes(0)
  })

  it('should not throw any errors if the email address does not exist', async () => {
    const query = `mutation {
      sendEmailConfirmation(email: "whatever@bar.com") {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.data.sendEmailConfirmation.message).toBeTruthy()
    expect(mailerServiceMock['send']).toHaveBeenCalledTimes(0)
  })

  it('should not throw any errors if the email address is already confirmed', async () => {
    await prisma.user.update({
      where: { id: userRecord.id },
      data: { isEmailConfirmed: true, emailConfirmationToken: null },
    })
    const query = `mutation {
      sendEmailConfirmation(email: "${userRecord.email}") {
        message
      }
    }
    `

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.data.sendEmailConfirmation.message).toBeTruthy()
    expect(mailerServiceMock['send']).toHaveBeenCalledTimes(0)
  })

  it('should throw a validation error if the email address is not valid', async () => {
    const query = `mutation {
      sendEmailConfirmation(email: "${TextUtils.generateRandomCharacters()}") {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    expect(mailerServiceMock['send']).toHaveBeenCalledTimes(0)
  })
})
