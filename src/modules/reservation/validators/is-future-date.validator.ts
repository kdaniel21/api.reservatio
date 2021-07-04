import { DateUtils } from '@common/utils/date-utils'
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'
import { isPast } from 'date-fns'

export function IsFutureDate(validationOptions?: ValidationOptions) {
  return (object: any, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsFutureDateConstraint,
    })
  }
}

@ValidatorConstraint({ name: 'IsFutureDate' })
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    const date = DateUtils.removeTime(new Date(value))
    return !isPast(date)
  }

  defaultMessage(args: ValidationArguments): string {
    return `The ${args.property} date must be in the future!`
  }
}
