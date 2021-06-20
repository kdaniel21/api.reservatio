import { Match } from '@auth/validators/match.validator'
import { ArgsType, Field } from '@nestjs/graphql'
import { MinLength, MaxLength, Matches } from 'class-validator'

@ArgsType()
export class ChangePasswordArgs {
  @Field()
  passwordResetToken: string

  // TODO: Sew together types with register.args.ts
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/)
  @Field()
  password: string

  @Match('password')
  @Field()
  passwordConfirm: string
}
