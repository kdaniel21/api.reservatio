import { RefreshToken } from '@prisma/client'
import { JwtToken } from '../../access-token/dto/jwt-token.interface'

export class LoginDto {
  accessToken: JwtToken
  refreshToken: RefreshToken
  unHashedRefreshToken: string
}
