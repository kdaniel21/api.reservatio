import { DomainException } from 'src/common/core/domain-exception'

export namespace RegisterExceptions {
  export class InvalidInvitation extends DomainException {
    constructor() {
      super({ message: 'The invitation is either invalid or expired!', code: 'INVALID_INVITATION' })
    }
  }

  export class EmailAlreadyRegistered extends DomainException {
    constructor() {
      super({ message: 'Email address is already registered!', code: 'EMAIL_ALREADY_REGISTERED' })
    }
  }
}
