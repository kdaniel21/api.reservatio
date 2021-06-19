import { DomainException } from '@common/core/domain-exception'

export namespace EmailConfirmationExceptions {
  export class InvalidEmailConfirmationToken extends DomainException {
    constructor() {
      super({
        message: 'The provided email confirmation token is either invalid or expired!',
        code: 'INVALID_EMAIL_CONFIRMATION_TOKEN',
      })
    }
  }

  export class EmailAlreadyConfirmed extends DomainException {
    constructor() {
      super({
        message: 'The provided email address has already been confirmed!',
        code: 'EMAIL_ALREADY_CONFIRMED',
      })
    }
  }
}
