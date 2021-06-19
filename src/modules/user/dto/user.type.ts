import { Field, ID, ObjectType } from '@nestjs/graphql'
import { User } from '@prisma/client'
import { CustomerType } from 'src/modules/customer/dto/customer.type'

@ObjectType()
export class UserType implements Partial<User> {
  // TODO: Make everything readonly
  @Field(() => ID)
  readonly id: string

  @Field()
  readonly email: string

  @Field()
  readonly isEmailConfirmed: boolean

  @Field(() => CustomerType)
  readonly customer?: CustomerType
}
