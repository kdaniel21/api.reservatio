import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'
import { isBefore } from 'date-fns'

export function IsTimeBefore(property: string, validationOptions?: ValidationOptions) {
  return (object: any, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: IsTimeBeforeConstraint,
    })
  }
}

@ValidatorConstraint({ name: 'IsTimeBefore' })
export class IsTimeBeforeConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    const [relatedPropertyName] = args.constraints
    const relatedValue = args.object?.[relatedPropertyName]

    const date = new Date(value)
    const relatedDate = new Date(relatedValue)

    return isBefore(date, relatedDate)
  }

  defaultMessage(args: ValidationArguments): string {
    const [relatedPropertyName] = args.constraints
    return `The '${args.property}' date must be before the '${relatedPropertyName}'`
  }
}
