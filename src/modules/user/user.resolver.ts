import { Parent, ResolveField, Resolver } from '@nestjs/graphql'
import { CustomerType } from '../customer/dto/customer.type'
import { UserType } from './dto/user.type'
import { UserService } from './user.service'

@Resolver(() => UserType)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @ResolveField()
  async customer(@Parent() user: UserType): Promise<CustomerType> {
    return this.userService.getCustomerByUser(user)
  }
}
