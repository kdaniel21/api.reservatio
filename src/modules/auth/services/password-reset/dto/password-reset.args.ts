import { ArgsType, Field } from '@nestjs/graphql'
import { IsEmail } from 'class-validator'

@ArgsType()
export class PasswordResetArgs {
  @IsEmail()
  @Field()
  readonly email: string
}
