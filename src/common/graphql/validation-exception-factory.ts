import { ValidationError } from '@nestjs/common'
import { DomainException } from '../core/domain-exception'

const extractMessage = (errors: ValidationError[]): string => {
  if (!errors.length) return 'Validation error!'

  const errorWithConstraintProp = errors.find((error) => error.hasOwnProperty('constraints'))
  if (errorWithConstraintProp) return Object.values(errorWithConstraintProp.constraints)[0]

  const allChildren = errors.flatMap((error) => error.children)
  return extractMessage(allChildren)
}

export const validationExceptionFactory = (errors: ValidationError[]) => {
  const message = extractMessage(errors)
  return new DomainException({ message, code: 'VALIDATION_ERROR' })
}
