import { ArgsType, Field } from '@nestjs/graphql'

@ArgsType()
export class ConfirmEmailAddressArgs {
  @Field()
  token: string
}
