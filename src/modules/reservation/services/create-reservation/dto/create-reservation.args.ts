import { ArgsType, Field, PickType } from '@nestjs/graphql'
import { ReservationLocationsInput } from '@reservation/dto/reservation-locations.input'
import { ReservationType } from '@reservation/dto/reservation.type'
import { ReservationLocationsValidator } from '@reservation/validators/reservation-locations.validator'

@ArgsType()
export class CreateReservationArgs extends PickType(ReservationType, ['name', 'startTime', 'endTime'], ArgsType) {
  @Field()
  @ReservationLocationsValidator()
  readonly locations: ReservationLocationsInput
}
