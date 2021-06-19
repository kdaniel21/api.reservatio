import { ArgsType, Field } from '@nestjs/graphql'
import { IsEmail, MaxLength, MinLength, Matches } from 'class-validator'
import { Match } from 'src/modules/auth/decorators/match.decorator'

@ArgsType()
export class RegisterArgs {
  @IsEmail()
  @Field()
  email: string

  @MinLength(3)
  @Field()
  name: string

  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/)
  @Field()
  password: string

  @Match('password')
  @Field()
  passwordConfirm: string

  @Field()
  invitationToken: string
}
