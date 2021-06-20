import { Field, ObjectType } from '@nestjs/graphql'

@ObjectType()
export class ReservationLocationsType {
  @Field({ defaultValue: false })
  tableTennis: boolean

  @Field({ defaultValue: false })
  badminton: boolean
}
