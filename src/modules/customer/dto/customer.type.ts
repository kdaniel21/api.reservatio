import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql'
import { Customer, CustomerRole } from '@prisma/client'
import { UserType } from 'src/modules/user/dto/user.type'

registerEnumType(CustomerRole, { name: 'CustomerRole' })

@ObjectType()
export class CustomerType implements Partial<Customer> {
  @Field(() => ID)
  readonly id: string

  readonly userId: string

  @Field()
  readonly name: string

  @Field(() => CustomerRole)
  readonly role: CustomerRole

  @Field(() => UserType)
  readonly user?: UserType

  // @Field(() => [ReservationType])
  // readonly reservations: ReservationType
}
