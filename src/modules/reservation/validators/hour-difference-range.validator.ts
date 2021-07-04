import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'
import { differenceInMinutes } from 'date-fns'

export function HourDifferenceRange({ property, min, max }, validationOptions?: ValidationOptions) {
  return (object: any, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property, min, max],
      validator: HourDifferenceRangeConstraint,
    })
  }
}

@ValidatorConstraint({ name: 'HourDifferenceRange' })
export class HourDifferenceRangeConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const [relatedPropertyName, minHoursDifference, maxHoursDifference] = args.constraints
    const relatedValue = args.object?.[relatedPropertyName]

    const date = new Date(value)
    const relatedDate = new Date(relatedValue)

    const hoursDifference = differenceInMinutes(date, relatedDate) / 60
    return minHoursDifference <= hoursDifference && hoursDifference <= maxHoursDifference
  }
}
