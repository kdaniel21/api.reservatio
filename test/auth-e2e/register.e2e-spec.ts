import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Invitation, PrismaClient } from '@prisma/client'
import { TextUtils } from 'src/common/utils/text-utils'
import { UserCreatedEvent } from 'src/modules/auth/events/user-created/user-created.event'
import supertest from 'supertest'
import { advanceTo } from 'jest-date-mock'
import clearAllData from 'test/setup/clear-all-data'
import { Test } from '@nestjs/testing'
import { applyMiddleware } from 'src/apply-middleware'
import { AuthModule } from 'src/modules/auth/auth.module'
import bcrypt from 'bcrypt'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { UserCreatedListener } from '@auth/events/user-created/user-created.listener'
import { MailerService } from '@mailer/mailer.service'
import { mocked } from 'ts-jest/utils'
import { RegisterTemplate } from '@mailer/templates/register/register.template'

describe('Register E2E', () => {
  let app: INestApplication
  let request: supertest.SuperTest<supertest.Test>
  let prisma: PrismaClient
  let config: ConfigService

  let invitation: Invitation
  let invitationToken: string

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

    advanceTo('2021-06-12 10:00')

    invitationToken = TextUtils.generateRandomCharacters(30)

    const user = await prisma.user.create({
      data: {
        email: 'inviter@bar.com',
        password: await bcrypt.hash('password', config.get('auth.bcrypt_salt_rounds')),
        isEmailConfirmed: true,
      },
    })

    invitation = await prisma.invitation.create({
      data: {
        inviterId: user.id,
        emailAddress: 'foo@bar.com',
        token: TextUtils.hashText(invitationToken),
        expiresAt: new Date('2021-06-13 14:00'),
      },
    })

    jest.clearAllMocks()
  })

  it('should register a new user and return the user', async () => {
    const query = `mutation {
      register(
        email: "foo@bar.com",
        name: "Foo Bar",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd",
        invitationToken: "${invitationToken}"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.data.register.message).toBeTruthy()
  })

  it('should deactivate the invitation after the user has been created', async () => {
    const query = `mutation {
      register(
        email: "foo@bar.com",
        name: "Foo Bar",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd",
        invitationToken: "${invitationToken}"
      ) {
        message
      }
    }`

    await request.post('/graphql').send({ query }).expect(200)

    const invitationRecord = await prisma.invitation.findUnique({ where: { id: invitation.id } })
    expect(invitationRecord.isActive).toBe(false)
  })

  it('should emit a UserCreatedEvent and fire an AfterUserCreated handler after creating a user', async () => {
    jest.spyOn(EventEmitter2.prototype, 'emit')
    jest.spyOn(UserCreatedListener.prototype, 'sendConfirmationEmail')
    jest.spyOn(UserCreatedListener.prototype, 'createCustomerProfile')
    const query = `mutation {
      register(
        email: "foo@bar.com",
        name: "Foo Bar",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd",
        invitationToken: "${invitationToken}"
      ) {
        message
      }
    }`

    await request.post('/graphql').send({ query }).expect(200)

    expect(EventEmitter2.prototype.emit).toHaveBeenCalledTimes(1)
    const userDoc = await prisma.user.findUnique({ where: { email: 'foo@bar.com' } })
    expect(EventEmitter2.prototype.emit).toHaveBeenCalledWith(
      UserCreatedEvent.name,
      expect.objectContaining({ props: { user: userDoc, name: 'Foo Bar' } }),
    )
    expect(UserCreatedListener.prototype.createCustomerProfile).toHaveBeenCalledTimes(1)
    expect(UserCreatedListener.prototype.sendConfirmationEmail).toHaveBeenCalledTimes(1)
  })

  it('should send a confirmation to the email address of the user with the email confirmation', async () => {
    jest.spyOn(MailerService.prototype, 'send' as keyof MailerService).mockResolvedValue(void 0)
    const query = `mutation {
      register(
        email: "foo@bar.com",
        name: "Foo Bar",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd",
        invitationToken: "${invitationToken}"
      ) {
        message
      }
    }`

    await request.post('/graphql').send({ query }).expect(200)

    const userRecord = await prisma.user.findUnique({ where: { email: 'foo@bar.com' } })
    expect(MailerService.prototype['send']).toHaveBeenCalledTimes(1)
    const sendToUserArguments = mocked(MailerService.prototype['send']).mock.calls[0]
    expect(sendToUserArguments[0]).toBe(RegisterTemplate)
    expect(sendToUserArguments[1]).toBe('foo@bar.com')
    expect((sendToUserArguments[2] as any).user.id).toBe(userRecord.id)
  })

  // it.skip('should create a new customer with the correct name', async () => {
  //   jest.spyOn(CreateCustomerUseCase.prototype, 'execute')
  //   const query = `mutation {
  //     register(
  //       email: "foo@bar.com",
  //       name: "Foo Bar",
  //       password: "Th1sIsAG00dPassw0rd",
  //       passwordConfirm: "Th1sIsAG00dPassw0rd",
  //       invitationToken: "${invitationToken}"
  //     ) {
  //       message
  //       accessToken
  //       refreshToken
  //     }
  //   }`

  //   await request.post('/graphql').send({ query }).expect(200)

  //   expect(CreateCustomerUseCase.prototype.execute).toHaveBeenCalledTimes(1)
  //   const userRecord = await prisma.user.findUnique({ where: { email: 'foo@bar.com' } })
  //   const customerRecord = await prisma.customer.findUnique({ where: { userId: userRecord.id } })
  //   expect(customerRecord.id).toBeTruthy()
  //   expect(customerRecord.name).toBe('Foo Bar')
  // })

  it.skip('should register a new user and store the user in the database', async () => {
    const query = `mutation {
      register(
        email: "foo@bar.com",
        name: "Foo Bar",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd",
        invitationToken: "${invitationToken}"
      ) {
        message
      }
    }`

    await request.post('/graphql').send({ query }).expect(200)

    const userRecord = await prisma.user.findUnique({ where: { email: 'foo@bar.com' } })
    expect(userRecord).toBeTruthy()
    expect(userRecord.email).toBe('foo@bar.com')
    expect(userRecord.isDeleted).toBe(false)
    expect(userRecord.isEmailConfirmed).toBe(false)
    expect(userRecord.emailConfirmationToken).toBeTruthy()
    expect(userRecord.password).toBeTruthy()
    expect(userRecord).not.toBe('Th1sIsAG00dPassw0rd')
    const doPasswordsMatch = await bcrypt.compare('Th1sIsAG00dPassw0rd', userRecord.password)
    expect(doPasswordsMatch).toBe(true)
    expect(userRecord.passwordResetToken).toBeFalsy()
    expect(userRecord.passwordResetTokenExpiresAt).toBeFalsy()
  })

  it('should throw an InvalidInvitation if the invitation is not active', async () => {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { isActive: false } })
    const query = `mutation {
      register(
        email: "foo@bar.com",
        name: "Foo Bar",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd",
        invitationToken: "${invitationToken}"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('INVALID_INVITATION')
    const numOfUsersWithEmail = await prisma.user.count({
      where: { email: 'foo@bar.com' },
    })
    expect(numOfUsersWithEmail).toBe(0)
  })

  it('should throw an InvalidInvitation if the invitation is expired', async () => {
    advanceTo('2021-06-13 16:00')
    const query = `mutation {
      register(
        email: "foo@bar.com",
        name: "Foo Bar",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd",
        invitationToken: "${invitationToken}"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('INVALID_INVITATION')
    const numOfUsersWithEmail = await prisma.user.count({
      where: { email: 'foo@bar.com' },
    })
    expect(numOfUsersWithEmail).toBe(0)
  })

  it('should throw an InvalidInvitation if the email address is different than the one in the invitation', async () => {
    const query = `mutation {
      register(
        email: "different@bar.com",
        name: "Foo Bar",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd",
        invitationToken: "${invitationToken}"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('INVALID_INVITATION')
    const numOfUsersWithEmail = await prisma.user.count({
      where: { email: 'different@bar.com' },
    })
    expect(numOfUsersWithEmail).toBe(0)
  })

  it('should throw an InvalidInvitation if the invitation token is invalid', async () => {
    const query = `mutation {
      register(
        email: "foo@bar.com",
        name: "Foo Bar",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd",
        invitationToken: "${TextUtils.generateRandomCharacters(10)}"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('INVALID_INVITATION')
    const numOfUsersWithEmail = await prisma.user.count({
      where: { email: 'foo@bar.com' },
    })
    expect(numOfUsersWithEmail).toBe(0)
  })

  it(`should throw a GraphQL validation error if no 'invitationToken' is provided`, async () => {
    const query = `mutation {
      register(
        email: "foo@bar.com",
        name: "Foo Bar",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
    const numOfUsersWithEmail = await prisma.user.count({
      where: { email: 'foo@bar.com' },
    })
    expect(numOfUsersWithEmail).toBe(0)
  })

  it('should throw a validation error if registering with an invalid email address', async () => {
    const query = `mutation {
      register(
        email: "foo",
        name: "Foo Foo",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd",
        invitationToken: "${invitationToken}"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    const numOfUsersWithEmail = await prisma.user.count({
      where: { email: 'foo' },
    })
    expect(numOfUsersWithEmail).toBe(0)
  })

  it('should throw an validation error if registering with an invalid name', async () => {
    const query = `mutation {
      register(
        email: "foo@bar.com",
        name: "Fo",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd",
        invitationToken: "${invitationToken}"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    const numOfUsersWithEmail = await prisma.user.count({
      where: { email: 'foo@bar.com' },
    })
    expect(numOfUsersWithEmail).toBe(0)
  })

  it('should throw an validation error if registering with an invalid password', async () => {
    const query = `mutation {
      register(
        email: "foo@bar.com",
        name: "Foo Foo",
        password: "badpassword",
        passwordConfirm: "badpassword",
        invitationToken: "${invitationToken}"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    const numOfUsersWithEmail = await prisma.user.count({
      where: { email: 'foo@bar.com' },
    })
    expect(numOfUsersWithEmail).toBe(0)
  })

  it('should throw a validation error if the passwords do not match', async () => {
    const query = `mutation {
      register(
        email: "foo@bar.com",
        name: "Foo Foo",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAB4dPassw0rd",
        invitationToken: "${invitationToken}"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    const numOfUsersWithEmail = await prisma.user.count({
      where: { email: 'foo@bar.com' },
    })
    expect(numOfUsersWithEmail).toBe(0)
  })

  it('should throw an EmailAlreadyRegistered if registering with an email address that is already being used', async () => {
    const alreadyRegisteredUser = await prisma.user.create({
      data: {
        email: 'foo@bar.com',
        password: 'foobar',
      },
    })
    const query = `mutation {
      register(
        email: "foo@bar.com",
        name: "Foo Foo",
        password: "Th1sIsAG00dPassw0rd",
        passwordConfirm: "Th1sIsAG00dPassw0rd",
        invitationToken: "${invitationToken}"
      ) {
        message
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('EMAIL_ALREADY_REGISTERED')
    const usersWithEmail = await prisma.user.findMany({
      where: { email: 'foo@bar.com' },
    })
    expect(usersWithEmail.length).toBe(1)
    expect(usersWithEmail[0].id).toBe(alreadyRegisteredUser.id)
  })
})
