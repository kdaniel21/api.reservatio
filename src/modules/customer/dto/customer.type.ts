import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql'
import { Customer, CustomerRole } from '@prisma/client'
import { UserType } from 'src/modules/user/dto/user.type'

registerEnumType(CustomerRole, { name: 'CustomerRole' })

@ObjectType()
export class CustomerType implements Partial<Customer> {
  @Field(() => ID)
  readonly id: string

  @Field()
  readonly name: string

  @Field(() => CustomerRole)
  readonly role: CustomerRole

  readonly userId: string

  @Field(() => UserType)
  readonly user?: UserType
}
