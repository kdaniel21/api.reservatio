import { ArgsType, Field, PickType } from '@nestjs/graphql'
import { ReservationLocationsInput } from '@reservation/dto/reservation-locations.input'
import { ReservationType } from '@reservation/dto/reservation.type'
import { ReservationLocationsValidator } from '@reservation/validators/reservation-locations.validator'
import { MaxLength, MinLength } from 'class-validator'

@ArgsType()
export class CreateReservationArgs extends PickType(ReservationType, ['startTime', 'endTime'], ArgsType) {
  @MinLength(3)
  @MaxLength(40)
  @Field()
  readonly name: string

  @Field()
  @ReservationLocationsValidator()
  readonly locations: ReservationLocationsInput
}
