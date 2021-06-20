import { DomainException } from '@common/core/domain-exception'

export namespace ReservationExceptions {
  export class ReservationNotFound extends DomainException {
    constructor() {
      super({
        message: 'The selected reservation does not exist!',
        code: 'RESERVATION_NOT_FOUND',
      })
    }
  }

  export class ReservationNotAuthorized extends DomainException {
    constructor() {
      super({
        message: 'You are not authorized to access the selected reservation!',
        code: 'RESERVATION_NOT_AUTHORIZED',
      })
    }
  }

  export class TimeNotAvailable extends DomainException {
    constructor() {
      super({ message: 'The selected time is not available!', code: 'TIME_NOT_AVAILABLE' })
    }
  }
}
