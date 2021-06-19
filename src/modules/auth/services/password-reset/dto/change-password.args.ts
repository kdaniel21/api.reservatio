import { Match } from '@auth/decorators/match.decorator'
import { ArgsType, Field } from '@nestjs/graphql'
import { MinLength, MaxLength, Matches } from 'class-validator'

@ArgsType()
export class ChangePasswordArgs {
  @Field()
  passwordResetToken: string

  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/)
  @Field()
  password: string

  @Match('password')
  @Field()
  passwordConfirm: string
}
