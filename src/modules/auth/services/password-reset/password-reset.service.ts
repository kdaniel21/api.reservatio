import { AuthExceptions } from '@auth/auth.exceptions'
import { PasswordResetCreatedEvent } from '@auth/events/password-reset-created/password-reset-created.event'
import { PrismaService } from '@common/services/prisma.service'
import { TextUtils } from '@common/utils/text-utils'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { User } from '@prisma/client'
import { addHours, isPast } from 'date-fns'
import { ChangePasswordArgs } from './dto/change-password.args'
import { PasswordResetExceptions } from './password-reset.exceptions'
import bcrypt from 'bcrypt'

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createPasswordResetToken(emailAddress: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: emailAddress } })
    if (!user) return

    if (!user.isEmailConfirmed) throw new AuthExceptions.EmailNotConfirmed()

    const tokenLength = this.config.get<number>('auth.password_reset_token_length')
    const token = TextUtils.generateRandomCharacters(tokenLength)
    const hashedToken = TextUtils.hashText(token)

    const expirationHours = this.config.get<number>('auth.password_reset_token_expiration_hours')
    const expiresAt = addHours(new Date(), expirationHours)

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: hashedToken, passwordResetTokenExpiresAt: expiresAt },
    })

    const event = new PasswordResetCreatedEvent({ user, passwordResetToken: token })
    this.eventEmitter.emit(PasswordResetCreatedEvent.name, event)
  }

  async changePasswordUsingToken(args: ChangePasswordArgs): Promise<void> {
    const user = await this.getUserByPasswordResetToken(args.passwordResetToken)

    // TODO: Potentially move to one service so that this and register can call the same method -> DRY
    const saltRounds = this.config.get<number>('auth.bcrypt_salt_rounds')
    const hashedPassword = await bcrypt.hash(args.password, saltRounds)
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, passwordResetToken: null, passwordResetTokenExpiresAt: null },
    })
  }

  private async getUserByPasswordResetToken(token: string): Promise<User> {
    const hashedToken = TextUtils.hashText(token)

    const user = await this.prisma.user.findUnique({ where: { passwordResetToken: hashedToken } })
    if (!user) throw new PasswordResetExceptions.InvalidPasswordResetToken()

    const isTokenExpired = isPast(user.passwordResetTokenExpiresAt)
    if (isTokenExpired) throw new PasswordResetExceptions.InvalidPasswordResetToken()

    return user
  }
}
