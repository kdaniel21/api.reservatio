import { DomainException } from 'src/common/core/domain-exception'

export namespace RefreshTokenExceptions {
  export class InvalidRefreshToken extends DomainException {
    constructor() {
      super({ message: 'The provided refresh token is either invalid or expired!', code: 'INVALID_REFRESH_TOKEN' })
    }
  }
}
