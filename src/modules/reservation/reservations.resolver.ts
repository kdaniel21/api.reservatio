import { CurrentCustomer } from '@auth/decorators/current-customer.decorator'
import { GqlAuthGuard } from '@auth/guards/gql-auth.guard'
import { ResolveCurrentCustomerInterceptor } from '@auth/interceptors/resolve-current-customer.interceptor'
import { UseGuards, UseInterceptors } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { Customer } from '@prisma/client'
import { ReservationType } from './dto/reservation.type'
import { CreateReservationService } from './services/create-reservation/create-reservation.service'
import { CreateReservationArgs } from './services/create-reservation/dto/create-reservation.args'
import { GetReservationArgs } from './services/get-reservation/dto/get-reservation.agrs'
import { GetReservationService } from './services/get-reservation/get-reservation.service'
import { AreTimesAvailableArgs } from './services/times-availability/dto/are-times-availabe.args'
import { isRecurringTimeAvailableArgs } from './services/times-availability/dto/is-recurring-time-available.args'
import { RecurringTimeAvailabilityType } from './services/times-availability/dto/recurring-time-availability.type'
import { TimeProposalAvailability } from './services/times-availability/dto/time-proposal-availability.type'
import { TimesAvailabilityService } from './services/times-availability/times-availability.service'

@UseGuards(GqlAuthGuard)
@UseInterceptors(ResolveCurrentCustomerInterceptor)
@Resolver()
export class ReservationsResolver {
  constructor(
    private readonly getReservationService: GetReservationService,
    private readonly timeAvailabilityService: TimesAvailabilityService,
    private readonly createReservationService: CreateReservationService,
  ) {}

  @Query(() => ReservationType)
  reservation(@Args() args: GetReservationArgs, @CurrentCustomer() customer: Customer): Promise<ReservationType> {
    return this.getReservationService.getReservationById(args, customer)
  }

  @Query(() => [TimeProposalAvailability])
  areTimesAvailable(@Args() args: AreTimesAvailableArgs): Promise<TimeProposalAvailability[]> {
    return this.timeAvailabilityService.areTimesAvailable(args.timeProposals)
  }

  @Query(() => RecurringTimeAvailabilityType)
  isRecurringTimeAvailable(@Args() args: isRecurringTimeAvailableArgs): Promise<RecurringTimeAvailabilityType> {
    return this.timeAvailabilityService.isRecurringTimeAvailable(args)
  }

  @Mutation(() => ReservationType)
  async createReservation(
    @Args() args: CreateReservationArgs,
    @CurrentCustomer() customer: Customer,
  ): Promise<ReservationType> {
    return this.createReservationService.createReservation(args, customer)
  }
}
