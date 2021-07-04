import { Injectable } from '@nestjs/common'
import { User } from '@prisma/client'
import { PrismaService } from 'src/common/services/prisma.service'
import { RegisterArgs } from './dto/register.args'
import { RegisterExceptions } from './register.exceptions'
import bcrypt from 'bcrypt'
import { ConfigService } from '@nestjs/config'
import { TextUtils } from 'src/common/utils/text-utils'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { UserCreatedEvent } from '../../events/user-created/user-created.event'
import { InvitationService } from 'src/modules/invitation/invitation.service'

@Injectable()
export class RegisterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly invitationService: InvitationService,
  ) {}

  async register(args: RegisterArgs): Promise<User> {
    const { email, invitationToken, password, name } = args

    const isInvitationValid = await this.isInvitationValid(invitationToken, email)
    if (!isInvitationValid) throw new RegisterExceptions.InvalidInvitation()

    const isEmailAlreadyRegistered = await this.isEmailAlreadyRegistered(email)
    if (isEmailAlreadyRegistered) throw new RegisterExceptions.EmailAlreadyRegistered()

    const hashedPassword = await this.hashPassword(password)
    const newUser = await this.prisma.user.create({
      data: { email, password: hashedPassword },
    })

    this.eventEmitter.emit(UserCreatedEvent.name, new UserCreatedEvent({ user: newUser, name, invitationToken }))

    return newUser
  }

  private async isInvitationValid(invitationToken: string, email: string): Promise<boolean> {
    const hashedInvitationToken = TextUtils.hashText(invitationToken)
    const invitation = await this.prisma.invitation.findUnique({ where: { token: hashedInvitationToken } })
    if (!invitation) return false

    const doEmailsMatch = invitation?.emailAddress === email
    const isRedeemable = this.invitationService.isInvitationRedeemable(invitation)

    return isRedeemable && doEmailsMatch
  }

  private hashPassword(password: string): Promise<string> {
    const saltRounds = this.configService.get<number>('auth.bcrypt_salt_rounds')
    return bcrypt.hash(password, saltRounds)
  }

  private async isEmailAlreadyRegistered(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email } })
    return count !== 0
  }
}
