import { ArgsType, Field, ID } from '@nestjs/graphql'

@ArgsType()
export class GetInvitationArgs {
  @Field(() => ID)
  readonly id: string
}
