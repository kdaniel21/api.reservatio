import { Field, ObjectType } from '@nestjs/graphql'
import { UserType } from '@user/dto/user.type'

@ObjectType()
export class LoginType {
  @Field()
  accessToken: string

  @Field()
  refreshToken: string

  @Field(() => UserType)
  user: UserType
}
