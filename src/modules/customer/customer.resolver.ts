import { Parent, ResolveField, Resolver } from '@nestjs/graphql'
import { UserType } from '../user/dto/user.type'
import { UserService } from '../user/user.service'
import { CustomerType } from './dto/customer.type'

@Resolver(() => CustomerType)
export class CustomerResolver {
  constructor(private readonly userService: UserService) {}

  @ResolveField()
  async user(@Parent() customer: CustomerType): Promise<UserType> {
    return this.userService.getUserById(customer.userId)
  }
}
