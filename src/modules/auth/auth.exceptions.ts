import { DomainException } from '@common/core/domain-exception'

export namespace AuthExceptions {
  // TODO: Remove if not needed
  // export class InvalidUser extends DomainException {
  //   constructor() {
  //     super({
  //       message: 'No user exists with given email address.',
  //       code: 'INVALID_USER',
  //     })
  //   }
  // }

  export class EmailNotConfirmed extends DomainException {
    constructor() {
      super({
        message: 'The email address is not confirmed. Please confirm it before logging in!',
        code: 'EMAIL_NOT_CONFIRMED',
      })
    }
  }
}
