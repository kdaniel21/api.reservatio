import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/common/services/prisma.service'
import bcrypt from 'bcrypt'
import { AccessTokenService } from '../access-token/access-token.service'
import { RefreshTokenService } from '../refresh-token/refresh-token.service'
import { LoginExceptions } from './login.exceptions'
import { LoginDto } from './dto/login.dto'
import { AuthExceptions } from '@auth/auth.exceptions'

@Injectable()
export class LoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessTokenService: AccessTokenService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async login(email: string, password: string): Promise<LoginDto> {
    const user = await this.prisma.user.findUnique({ where: { email } })

    const isEmailRegistered = !!user
    if (!isEmailRegistered) throw new LoginExceptions.InvalidCredentials()

    if (user.isDeleted) throw new LoginExceptions.InvalidCredentials()

    const doPasswordsMatch = await bcrypt.compare(password, user.password)
    if (!doPasswordsMatch) throw new LoginExceptions.InvalidCredentials()

    if (!user.isEmailConfirmed) throw new AuthExceptions.EmailNotConfirmed()

    const accessToken = await this.accessTokenService.createAccessTokenForUser(user)
    const { refreshToken, unHashedToken } = await this.refreshTokenService.createRefreshToken(user)

    return { accessToken, refreshToken, unHashedRefreshToken: unHashedToken }
  }
}
