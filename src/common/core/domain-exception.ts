export class DomainException {
  readonly message: string = 'Something went wrong unexpectedly!'
  readonly code: string = 'UNEXPECTED_ERROR'

  constructor(params: { message?: string; code?: string }) {
    Object.assign(this, params)
  }
}
