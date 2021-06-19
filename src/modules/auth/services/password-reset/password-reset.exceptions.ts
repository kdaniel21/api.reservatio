import { DomainException } from '@common/core/domain-exception'

export namespace PasswordResetExceptions {
  export class InvalidPasswordResetToken extends DomainException {
    constructor() {
      super({
        message: 'The provided password reset token is either invalid or expired.',
        code: 'INVALID_PASSWORD_RESET_TOKEN',
      })
    }
  }
}
