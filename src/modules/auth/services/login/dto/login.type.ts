import { Field, ObjectType } from '@nestjs/graphql'

@ObjectType()
export class LoginType {
  @Field()
  accessToken: string

  @Field()
  refreshToken: string

  // @Field(() => UserType)
  // user: UserType
}
