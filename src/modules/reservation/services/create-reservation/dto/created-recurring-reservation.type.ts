import { Field, ID, ObjectType } from '@nestjs/graphql'

@ObjectType()
export class CreatedRecurringReservationType {
  @Field(() => ID)
  readonly recurringId: string

  @Field()
  readonly count: number
}
