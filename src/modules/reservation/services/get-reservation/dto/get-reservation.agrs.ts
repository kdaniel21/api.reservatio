import { ArgsType, Field, ID } from '@nestjs/graphql'

@ArgsType()
export class GetReservationArgs {
  @Field(() => ID)
  readonly id: string
}
