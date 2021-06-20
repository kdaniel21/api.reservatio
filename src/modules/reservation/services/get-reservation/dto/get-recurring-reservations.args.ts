import { ArgsType, Field, ID } from '@nestjs/graphql'

@ArgsType()
export class GetRecurringReservationsArgs {
  @Field(() => ID)
  readonly recurringId: string

  @Field({ defaultValue: false })
  readonly futureOnly: boolean
}
