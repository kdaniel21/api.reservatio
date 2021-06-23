import { CurrentCustomer } from '@auth/decorators/current-customer.decorator'
import { CustomerRolesGuard } from '@auth/guards/customer-roles.guard'
import { GqlAuthGuard } from '@auth/guards/gql-auth.guard'
import { ResolveCurrentCustomerInterceptor } from '@auth/interceptors/resolve-current-customer.interceptor'
import { UseGuards, UseInterceptors } from '@nestjs/common'
import { Query, Args, Mutation, Resolver } from '@nestjs/graphql'
import { Customer } from '@prisma/client'
import { CreateInvitationArgs } from './dto/create-invitation.args'
import { InvitationType } from './dto/invitation.type'
import { InvitationsType } from './dto/invitations.type'
import { UpdateInvitationArgs } from './dto/update-invitation.args'
import { InvitationService } from './invitation.service'
import { findManyCursorConnection } from '@devoxa/prisma-relay-cursor-connection'
import { PaginationArgs } from '@common/graphql/dto/pagination.args'

// @CustomerRoles(CustomerRole.ADMIN)
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

  @Query(() => InvitationsType)
  invitations(@Args() args: PaginationArgs): Promise<InvitationsType> {
    return findManyCursorConnection(
      (args) => this.invitationService.getInvitations(args),
      () => this.invitationService.getTotalNumOfInvitations(),
      args,
      {
        encodeCursor: (cursor) => Buffer.from(JSON.stringify(cursor)).toString('base64'),
        decodeCursor: (cursor) => JSON.parse(Buffer.from(cursor, 'base64').toString('ascii')),
      },
    )
  }
}
