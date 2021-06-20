import { Field, InputType } from '@nestjs/graphql'
import { ReservationLocationsType } from './reservation-locations.type'

@InputType()
export class ReservationLocationsInput implements ReservationLocationsType {
  @Field({ nullable: true, defaultValue: false })
  tableTennis: boolean

  @Field({ nullable: true, defaultValue: false })
  badminton: boolean
}
