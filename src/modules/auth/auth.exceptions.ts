import { DomainException } from '@common/core/domain-exception'

export namespace AuthExceptions {
  export class NotAuthenticated extends DomainException {
    constructor() {
      super({ message: 'You are not authenticated!', code: 'NOT_AUTHENTICATED' })
    }
  }

  export class NotAuthorized extends DomainException {
    constructor() {
      super({ message: 'You are not authorized!', code: 'NOT_AUTHORIZED' })
    }
  }

  // TODO: Remove if not needed
  // export class InvalidUser extends DomainException {
  //   constructor() {
  //     super({
  //       message: 'No user exists with given email address.',
  //       code: 'INVALID_USER',
  //     })
  //   }
  // }

  export class InvalidCustomer extends DomainException {
    constructor() {
      super({
        message: 'No customer exists with given email address.',
        code: 'INVALID_CUSTOMER',
      })
    }
  }

  export class EmailNotConfirmed extends DomainException {
    constructor() {
      super({
        message: 'The email address is not confirmed. Please confirm it before logging in!',
        code: 'EMAIL_NOT_CONFIRMED',
      })
    }
  }
}
