import { CurrentCustomer } from '@auth/decorators/current-customer.decorator'
import { CustomerRoles } from '@auth/decorators/customer-roles.decorator'
import { CustomerRolesGuard } from '@auth/guards/customer-roles.guard'
import { GqlAuthGuard } from '@auth/guards/gql-auth.guard'
import { ResolveCurrentCustomerInterceptor } from '@auth/interceptors/resolve-current-customer.interceptor'
import { UseGuards, UseInterceptors } from '@nestjs/common'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { Customer, CustomerRole } from '@prisma/client'
import { CreateInvitationArgs } from './dto/create-invitation.args'
import { InvitationType } from './dto/invitation.type'
import { UpdateInvitationArgs } from './dto/update-invitation.args'
import { InvitationService } from './invitation.service'

@CustomerRoles(CustomerRole.ADMIN)
@UseGuards(GqlAuthGuard, CustomerRolesGuard)
@UseInterceptors(ResolveCurrentCustomerInterceptor)
@Resolver()
export class InvitationsResolver {
  constructor(private readonly invitationService: InvitationService) {}

  @Mutation(() => InvitationType)
  sendInvitation(@Args() args: CreateInvitationArgs, @CurrentCustomer() customer: Customer): Promise<InvitationType> {
    return this.invitationService.createInvitation(args, customer)
  }

  @Mutation(() => InvitationType)
  updateInvitation(@Args() args: UpdateInvitationArgs): Promise<InvitationType> {
    return this.invitationService.updateInvitation(args)
  }
}
