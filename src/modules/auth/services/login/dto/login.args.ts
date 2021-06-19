import { ArgsType, Field } from '@nestjs/graphql'
import { IsEmail } from 'class-validator'

@ArgsType()
export class LoginArgs {
  @IsEmail()
  @Field()
  readonly email: string

  @Field()
  readonly password: string
}
