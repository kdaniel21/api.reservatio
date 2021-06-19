import { DomainException } from 'src/common/core/domain-exception'

export namespace LoginExceptions {
  export class InvalidCredentials extends DomainException {
    constructor() {
      super({ message: 'The entered credentials are invalid!', code: 'INVALID_CREDENTIALS' })
    }
  }
}
