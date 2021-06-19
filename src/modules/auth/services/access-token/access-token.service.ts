import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { JwtPayload } from './dto/jwt-payload.interface'
import { JwtToken } from './dto/jwt-token.interface'
import { User } from '@prisma/client'
import { PrismaService } from 'src/common/services/prisma.service'
import { RefreshTokenService } from '../refresh-token/refresh-token.service'

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async createAccessTokenForUser(user: User): Promise<JwtToken> {
    const customer = await this.prisma.customer.findUnique({ where: { userId: user.id } })

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      customerId: customer?.id,
      customerRole: customer?.role,
    }

    const accessToken = this.jwtService.sign(payload)
    return accessToken
  }

  async renewAccessToken(refreshToken: string): Promise<JwtToken> {
    const user = await this.refreshTokenService.getUserByRefreshToken(refreshToken)

    return this.createAccessTokenForUser(user)
  }

  // TODO: Remove if redundant
  // decodeAccessToken(token: JwtToken): JwtPayload {
  //   const payload = this.jwtService.verify<JwtPayload>(token)

  //   return payload
  // }
}
