import { CustomerRoles } from '@auth/decorators/customer-roles.decorator'
import { CustomerRolesGuard } from '@auth/guards/customer-roles.guard'
import { GqlAuthGuard } from '@auth/guards/gql-auth.guard'
import { ResolveCurrentCustomerInterceptor } from '@auth/interceptors/resolve-current-customer.interceptor'
import { MessageType } from '@common/graphql/dto/message.type'
import { CustomerService } from '@customer/customer.service'
import { CustomerType } from '@customer/dto/customer.type'
import { UseGuards, UseInterceptors } from '@nestjs/common'
import { Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CustomerRole } from '@prisma/client'
import { InvitationType } from './dto/invitation.type'

@CustomerRoles(CustomerRole.ADMIN)
@UseGuards(GqlAuthGuard, CustomerRolesGuard)
@UseInterceptors(ResolveCurrentCustomerInterceptor)
@Resolver(() => InvitationType)
export class InvitationResolver {
  constructor(private readonly customerService: CustomerService) {}

  @ResolveField(() => CustomerType)
  inviter(@Parent() invitation: InvitationType): Promise<CustomerType> {
    return this.customerService.getCustomerById(invitation.inviterId)
  }

  @Query(() => MessageType)
  foo(): MessageType {
    return { message: 'bar' }
  }
}
