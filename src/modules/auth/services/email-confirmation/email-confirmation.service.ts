import { EmailConfirmationCreatedEvent } from '@auth/events/email-confirmation-created/email-confirmation-created.event'
import { PrismaService } from '@common/services/prisma.service'
import { TextUtils } from '@common/utils/text-utils'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { User } from '@prisma/client'
import { addHours, isPast } from 'date-fns'
import { ConfirmEmailAddressArgs } from './dto/confirm-email-address.args'
import { EmailConfirmationExceptions } from './email-confirmation.exceptions'

@Injectable()
export class EmailConfirmationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async reSendEmailConfirmation(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user) return

    try {
      await this.createEmailConfirmationToken(user)
    } catch {}
  }

  async createEmailConfirmationToken(user: User): Promise<User> {
    if (user.isEmailConfirmed) throw new EmailConfirmationExceptions.EmailAlreadyConfirmed()

    const tokenLength = this.config.get<number>('auth.email_confirmation_token_length')
    const token = TextUtils.generateRandomCharacters(tokenLength)

    const hashedToken = TextUtils.hashText(token)

    const expirationHours = this.config.get<number>('auth.email_confirmation_expiration_hours')
    const expiresAt = addHours(new Date(), expirationHours)

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailConfirmationToken: hashedToken, emailConfirmationTokenExpiresAt: expiresAt },
    })

    this.eventEmitter.emit(
      EmailConfirmationCreatedEvent.name,
      new EmailConfirmationCreatedEvent({ user: updatedUser, shouldSendEmail: !!user.emailConfirmationToken }),
    )

    return updatedUser
  }

  async confirmEmailAddress(args: ConfirmEmailAddressArgs): Promise<void> {
    const user = await this.getUserByConfirmationToken(args.token)

    await this.prisma.user.update({
      where: { id: user.id },
      data: { isEmailConfirmed: true, emailConfirmationToken: null, emailConfirmationTokenExpiresAt: null },
    })
  }

  private async getUserByConfirmationToken(token: string): Promise<User> {
    const hashedToken = TextUtils.hashText(token)
    const user = await this.prisma.user.findUnique({ where: { emailConfirmationToken: hashedToken } })
    if (!user) throw new EmailConfirmationExceptions.InvalidEmailConfirmationToken()

    const isTokenExpired = isPast(user.emailConfirmationTokenExpiresAt)
    if (isTokenExpired) throw new EmailConfirmationExceptions.InvalidEmailConfirmationToken()

    return user
  }
}
