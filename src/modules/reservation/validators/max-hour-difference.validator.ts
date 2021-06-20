import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'
import { differenceInHours } from 'date-fns'

export function MaxHourDifference({ property, hours }, validationOptions?: ValidationOptions) {
  return (object: any, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property, hours],
      validator: MaxHourDifferenceConstraint,
    })
  }
}

@ValidatorConstraint({ name: 'MaxTimeDifference' })
export class MaxHourDifferenceConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const [relatedPropertyName, maxHoursDifference] = args.constraints
    const relatedValue = args.object?.[relatedPropertyName]

    const date = new Date(value)
    const relatedDate = new Date(relatedValue)

    const hoursDifference = differenceInHours(date, relatedDate)
    return hoursDifference <= maxHoursDifference
  }
}
