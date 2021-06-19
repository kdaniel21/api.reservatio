import { CurrentCustomer } from '@auth/decorators/current-customer.decorator'
import { GqlAuthGuard } from '@auth/guards/gql-auth.guard'
import { ResolveCurrentCustomerInterceptor } from '@auth/interceptors/resolve-current-customer.interceptor'
import { UseGuards, UseInterceptors } from '@nestjs/common'
import { Args, Query, Resolver } from '@nestjs/graphql'
import { Customer } from '@prisma/client'
import { ReservationType } from './dto/reservation.type'
import { GetReservationArgs } from './services/get-reservation/dto/get-reservation.agrs'
import { GetReservationService } from './services/get-reservation/get-reservation.service'

@Resolver()
export class ReservationsResolver {
  constructor(private readonly getReservationService: GetReservationService) {}

  @UseGuards(GqlAuthGuard)
  @UseInterceptors(ResolveCurrentCustomerInterceptor)
  @Query(() => ReservationType)
  reservation(@Args() args: GetReservationArgs, @CurrentCustomer() customer: Customer): Promise<ReservationType> {
    return this.getReservationService.getReservationById(args, customer)
  }
}
