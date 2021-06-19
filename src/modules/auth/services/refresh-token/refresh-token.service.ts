import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from 'src/common/services/prisma.service'
import { TextUtils } from 'src/common/utils/text-utils'
import { addDays, isPast } from 'date-fns'
import { RefreshToken, User } from '@prisma/client'
import { RefreshTokenExceptions } from './refresh-token.exceptions'

@Injectable()
export class RefreshTokenService {
  constructor(private readonly configService: ConfigService, private readonly prisma: PrismaService) {}

  async createRefreshToken(user: User): Promise<{ refreshToken: RefreshToken; unHashedToken: string }> {
    const tokenLength = this.configService.get<number>('auth.refresh_token_length')
    const token = TextUtils.generateRandomCharacters(tokenLength)
    const hashedToken = TextUtils.hashText(token)

    const tokenExpirationDays = this.configService.get<number>('auth.refresh_token_expiration_days')
    const expiresAt = addDays(new Date(), tokenExpirationDays)

    const refreshToken = await this.prisma.refreshToken.create({
      data: { token: hashedToken, expiresAt, userId: user.id },
    })

    return { refreshToken, unHashedToken: token }
  }

  async getUserByRefreshToken(token: string): Promise<User> {
    const hashedToken = TextUtils.hashText(token)
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    })
    if (!refreshToken) throw new RefreshTokenExceptions.InvalidRefreshToken()

    const isValid = this.isRefreshTokenValid(refreshToken)
    if (!isValid) throw new RefreshTokenExceptions.InvalidRefreshToken()

    return refreshToken.user
  }

  async removeRefreshToken(token: string): Promise<void> {
    try {
      const hashedToken = TextUtils.hashText(token)
      await this.prisma.refreshToken.delete({ where: { token: hashedToken } })
    } catch {
      throw new RefreshTokenExceptions.InvalidRefreshToken()
    }
  }

  private isRefreshTokenValid(refreshToken: RefreshToken): boolean {
    const isExpired = isPast(refreshToken.expiresAt)

    return !isExpired
  }
}
