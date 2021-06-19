import { ArgsType, Field } from '@nestjs/graphql'

@ArgsType()
export class RefreshTokenArgs {
  @Field({ nullable: true })
  refreshToken?: string
}
