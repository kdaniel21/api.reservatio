import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'

export function ReservationLocationsValidator(validationOptions?: ValidationOptions) {
  return (object: any, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: ReservationLocationsValidatorConstraint,
    })
  }
}

@ValidatorConstraint({ name: 'ReservationLocationsValidator' })
export class ReservationLocationsValidatorConstraint implements ValidatorConstraintInterface {
  validate(value: any) {
    return Object.keys(value).some((key) => !!value[key])
  }
}
