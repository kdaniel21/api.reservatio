import { ValidationError } from '@nestjs/common'
import { DomainException } from '../core/domain-exception'

// TODO: Find a sophisticated solution
export const validationExceptionFactory = (errors: ValidationError[]) => {
  return new DomainException({ message: Object.values(errors[0].constraints)[0] as string, code: 'VALIDATION_ERROR' })
}
