import { Field, ID, ObjectType } from '@nestjs/graphql'
import { User } from '@prisma/client'

@ObjectType()
export class UserType implements Partial<User> {
  // TODO: Make everything readonly
  @Field(() => ID)
  readonly id: string

  @Field()
  readonly email: string

  @Field()
  readonly isEmailConfirmed: boolean

  // TODO: Add customer type
  // @Field()
  // customer: CustomerType
}
