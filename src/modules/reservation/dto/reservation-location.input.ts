import { Field, InputType } from '@nestjs/graphql'
import { ReservationLocationType } from './reservation-location.type'

@InputType()
export class ReservationLocationInput implements ReservationLocationType {
  @Field({ nullable: true, defaultValue: false })
  tableTennis: boolean

  @Field({ nullable: true, defaultValue: false })
  badminton: boolean
}
