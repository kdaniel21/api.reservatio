import { DomainException } from '@common/core/domain-exception'

export namespace InvitationExceptions {
  export class EmailAlreadyRegistered extends DomainException {
    constructor() {
      super({ message: 'This email address has already been registered!', code: 'EMAIL_ALREADY_REGISTERED' })
    }
  }
}
