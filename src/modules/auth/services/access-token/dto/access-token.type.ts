import { Field, ObjectType } from '@nestjs/graphql'
import { JwtToken } from './jwt-token.interface'

@ObjectType()
export class AccessTokenType {
  @Field(() => String)
  accessToken: JwtToken
}
