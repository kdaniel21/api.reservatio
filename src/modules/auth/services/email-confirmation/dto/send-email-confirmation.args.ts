import { ArgsType, Field } from '@nestjs/graphql'
import { IsEmail } from 'class-validator'

@ArgsType()
export class SendEmailConfirmationArgs {
  @IsEmail()
  @Field()
  email: string
}
