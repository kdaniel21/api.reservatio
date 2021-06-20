import { DomainException } from '@common/core/domain-exception'

export namespace CreateReservationExceptions {
  export class TimeNotAvailable extends DomainException {
    constructor() {
      super({ message: 'The selected time is not available!', code: 'TIME_NOT_AVAILABLE' })
    }
  }
}
