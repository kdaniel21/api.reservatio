import supertest from 'supertest'
import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { Customer, CustomerRole, PrismaClient, User } from '@prisma/client'
import { applyMiddleware } from 'src/apply-middleware'
import clearAllData from 'test/setup/clear-all-data'
import jwt from 'jsonwebtoken'
import { JwtPayload } from '@auth/services/access-token/dto/jwt-payload.interface'
import { advanceTo } from 'jest-date-mock'
import { TextUtils } from '@common/utils/text-utils'
import { MailerService } from '@mailer/mailer.service'
import { InvitationTemplate } from '@mailer/templates/invitation/invitation.template'
import { addHours } from 'date-fns'
import { InvitationModule } from 'src/modules/invitation/invitation.module'

describe('CreateInvitation E2E', () => {
  let app: INestApplication
  let request: supertest.SuperTest<supertest.Test>
  let prisma: PrismaClient
  let config: ConfigService

  let userRecord: User
  let customerRecord: Customer
  let accessToken: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [InvitationModule] }).compile()
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
        email: 'inviter@bar.com',
        password: TextUtils.generateRandomCharacters(),
        isEmailConfirmed: true,
      },
    })

    customerRecord = await prisma.customer.create({
      data: {
        userId: userRecord.id,
        name: 'Foo Bar',
        role: CustomerRole.ADMIN,
      },
    })

    accessToken = jwt.sign(
      {
        email: userRecord.email,
        userId: userRecord.id,
        customerId: customerRecord.id,
        customerRole: customerRecord.role,
      } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )

    jest.spyOn(MailerService.prototype, 'send' as keyof MailerService).mockResolvedValue(void 0)
    jest.clearAllMocks()
  })

  it('should create a valid invitation and return it', async () => {
    const query = `mutation {
      sendInvitation(emailAddress: "foo@bar.com") {
        id
        expiresAt
        inviter {
          id
          name
          role
          user {
            id
            email
          }
        }
        emailAddress
        isActive
        createdAt
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    const invitationRecord = await prisma.invitation.findFirst()
    expect(res.body.data.sendInvitation.id).toBe(invitationRecord.id)
    expect(res.body.data.sendInvitation.expiresAt).toBe(invitationRecord.expiresAt.toJSON())
    expect(res.body.data.sendInvitation.emailAddress).toBe('foo@bar.com')
    expect(res.body.data.sendInvitation.isActive).toBe(true)
    expect(res.body.data.sendInvitation.createdAt).toBe(invitationRecord.createdAt.toJSON())
    expect(res.body.data.sendInvitation.inviter.id).toBe(customerRecord.id)
    expect(res.body.data.sendInvitation.inviter.name).toBe(customerRecord.name)
    expect(res.body.data.sendInvitation.inviter.role).toBe(customerRecord.role)
    expect(res.body.data.sendInvitation.inviter.user.id).toBe(userRecord.id)
    expect(res.body.data.sendInvitation.inviter.user.email).toBe(userRecord.email)
  })

  it('should store the created invitation in the database', async () => {
    advanceTo('2021-06-12 17:00')
    const query = `mutation {
      sendInvitation(emailAddress: "foo@bar.com") {
        id
        expiresAt
        emailAddress
      }
    }`

    await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    const numOfInvitations = await prisma.invitation.count()
    expect(numOfInvitations).toBe(1)
    const invitationRecord = await prisma.invitation.findFirst()
    expect(invitationRecord.id).toBeTruthy()
    expect(invitationRecord.emailAddress).toBe('foo@bar.com')
    const expirationHours = config.get<number>('invitation.expiration_hours')
    const expectedExpiration = addHours(new Date(), expirationHours)
    expect(invitationRecord.expiresAt).toEqual(expectedExpiration)
    expect(invitationRecord.inviterId).toBe(customerRecord.id)
    expect(invitationRecord.isActive).toBe(true)
    expect(invitationRecord.token).toBeTruthy()
  })

  it('should send an invitation email', async () => {
    const query = `mutation {
      sendInvitation(emailAddress: "foo@bar.com") {
        id
        expiresAt
        emailAddress
      }
    }`

    await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    const invitationRecord = await prisma.invitation.findFirst()
    expect(MailerService.prototype['send']).toHaveBeenCalledTimes(1)
    expect(MailerService.prototype['send']).toHaveBeenCalledWith(
      InvitationTemplate,
      'foo@bar.com',
      expect.objectContaining({ invitation: invitationRecord, unHashedToken: expect.any(String) }),
    )
  })

  it('should allow sending an invitation to an email address that already has an ongoing invitation', async () => {
    await prisma.invitation.create({
      data: {
        inviterId: customerRecord.id,
        emailAddress: 'foo@bar.com',
        token: TextUtils.generateRandomCharacters(),
        expiresAt: new Date('2021-06-13 14:00'),
      },
    })
    const query = `mutation {
      sendInvitation(emailAddress: "foo@bar.com") {
        id
        expiresAt
        emailAddress
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.data.sendInvitation.id).toBeTruthy()
    const numOfInvitationsWithEmail = await prisma.invitation.count({ where: { emailAddress: 'foo@bar.com' } })
    expect(numOfInvitationsWithEmail).toBe(2)
  })

  it('should throw a ValidationError if the email address is invalid', async () => {
    const query = `mutation {
      sendInvitation(emailAddress: "foo") {
        id
        expiresAt
        emailAddress
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR')
    const numOfInvitations = await prisma.invitation.count()
    expect(numOfInvitations).toBe(0)
  })

  it('should throw an EmailAlreadyRegistered if the email has already been registered', async () => {
    const query = `mutation {
      sendInvitation(emailAddress: "inviter@bar.com") {
        id
        expiresAt
        emailAddress
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('EMAIL_ALREADY_REGISTERED')
    const numOfInvitations = await prisma.invitation.count()
    expect(numOfInvitations).toBe(0)
  })

  it('should throw a GraphQL validation failed error if no email address is provided', async () => {
    const query = `mutation {
      sendInvitation() {
        id
        expiresAt
        emailAddress
      }
    }`

    const res = await request.post('/graphql').send({ query }).set('Authorization', `Bearer ${accessToken}`).expect(400)

    expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_PARSE_FAILED')
    const numOfInvitations = await prisma.invitation.count()
    expect(numOfInvitations).toBe(0)
  })

  it('should throw a NotAuthenticated if no access token is provided', async () => {
    const query = `mutation {
      sendInvitation(emailAddress: "foo@bar.com") {
        id
        expiresAt
        emailAddress
      }
    }`

    const res = await request.post('/graphql').send({ query }).expect(200)

    expect(res.body.errors[0].extensions.code).toBe('NOT_AUTHENTICATED')
    const numOfInvitations = await prisma.invitation.count()
    expect(numOfInvitations).toBe(0)
  })

  it('should throw a NotAuthorizedError if a non-admin customer tries to create the invitation', async () => {
    await prisma.customer.update({ data: { role: CustomerRole.CUSTOMER }, where: { id: customerRecord.id } })
    const nonAdminAccessToken = jwt.sign(
      {
        email: userRecord.email,
        userId: userRecord.id,
        customerId: customerRecord.id,
        customerRole: CustomerRole.CUSTOMER,
      } as JwtPayload,
      config.get<string>('auth.jwt_secret'),
    )

    const query = `mutation {
      sendInvitation(emailAddress: "foo@bar.com") {
        id
        expiresAt
        emailAddress
      }
    }`

    const res = await request
      .post('/graphql')
      .send({ query })
      .set('Authorization', `Bearer ${nonAdminAccessToken}`)
      .expect(200)

    expect(res.body.errors[0].extensions.code).toBe('NOT_AUTHORIZED')
    const numOfInvitations = await prisma.invitation.count()
    expect(numOfInvitations).toBe(0)
  })
})
