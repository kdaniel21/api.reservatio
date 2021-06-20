import { Field, ObjectType } from '@nestjs/graphql'

@ObjectType()
export class RecurringTimeAvailabilityType {
  @Field(() => [Date])
  availableTimes: Date[]

  @Field(() => [Date])
  unavailableTimes: Date[]
}
