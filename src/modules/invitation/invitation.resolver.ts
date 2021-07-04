import { CustomerRoles } from '@auth/decorators/customer-roles.decorator'
import { CustomerRolesGuard } from '@auth/guards/customer-roles.guard'
import { GqlAuthGuard } from '@auth/guards/gql-auth.guard'
import { ResolveCurrentCustomerInterceptor } from '@auth/interceptors/resolve-current-customer.interceptor'
import { CustomerService } from '@customer/customer.service'
import { CustomerType } from '@customer/dto/customer.type'
import { UseGuards, UseInterceptors } from '@nestjs/common'
import { Parent, ResolveField, Resolver } from '@nestjs/graphql'
import { CustomerRole } from '@prisma/client'
import { InvitationType } from './dto/invitation.type'
import { InvitationService } from './invitation.service'

@CustomerRoles(CustomerRole.ADMIN)
@UseGuards(GqlAuthGuard, CustomerRolesGuard)
@UseInterceptors(ResolveCurrentCustomerInterceptor)
@Resolver(() => InvitationType)
export class InvitationResolver {
  constructor(
    private readonly customerService: CustomerService,
    private readonly invitationService: InvitationService,
  ) {}

  @ResolveField(() => CustomerType)
  inviter(@Parent() invitation: InvitationType): Promise<CustomerType> {
    return this.customerService.getCustomerById(invitation.inviterId)
  }

  @ResolveField(() => Boolean)
  isRedeemable(@Parent() invitation: InvitationType): boolean {
    return this.invitationService.isInvitationRedeemable(invitation)
  }
}
