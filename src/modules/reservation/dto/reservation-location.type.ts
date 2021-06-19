import { Field, ObjectType } from '@nestjs/graphql'

@ObjectType()
export class ReservationLocationType {
  @Field()
  tableTennis: boolean

  @Field()
  badminton: boolean
}
