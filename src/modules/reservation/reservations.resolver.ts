import { CurrentCustomer } from '@auth/decorators/current-customer.decorator'
import { GqlAuthGuard } from '@auth/guards/gql-auth.guard'
import { ResolveCurrentCustomerInterceptor } from '@auth/interceptors/resolve-current-customer.interceptor'
import { UseGuards, UseInterceptors } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { Customer, Reservation } from '@prisma/client'
import { ReservationType } from './dto/reservation.type'
import { CreateReservationService } from './services/create-reservation/create-reservation.service'
import { CreateRecurringReservationArgs } from './services/create-reservation/dto/create-recurring-reservation.args'
import { CreateReservationArgs } from './services/create-reservation/dto/create-reservation.args'
import { CreatedRecurringReservationType } from './services/create-reservation/dto/created-recurring-reservation.type'
import { GetReservationArgs } from './services/get-reservation/dto/get-reservation.args'
import { GetReservationsArgs } from './services/get-reservation/dto/get-reservations.args'
import { GetReservationService } from './services/get-reservation/get-reservation.service'
import { AreTimesAvailableArgs } from './services/times-availability/dto/are-times-availabe.args'
import { IsRecurringTimeAvailableArgs } from './services/times-availability/dto/is-recurring-time-available.args'
import { RecurringTimeAvailabilityType } from './services/times-availability/dto/recurring-time-availability.type'
import { TimeProposalAvailability } from './services/times-availability/dto/time-proposal-availability.type'
import { TimesAvailabilityService } from './services/times-availability/times-availability.service'
import { UpdateReservationArgs } from './services/update-reservation/dto/update-reservation.args'
import { UpdateReservationService } from './services/update-reservation/update-reservation.service'

@UseGuards(GqlAuthGuard)
@UseInterceptors(ResolveCurrentCustomerInterceptor)
@Resolver()
export class ReservationsResolver {
  constructor(
    private readonly getReservationService: GetReservationService,
    private readonly timeAvailabilityService: TimesAvailabilityService,
    private readonly createReservationService: CreateReservationService,
    private readonly updateReservationService: UpdateReservationService,
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
  isRecurringTimeAvailable(@Args() args: IsRecurringTimeAvailableArgs): Promise<RecurringTimeAvailabilityType> {
    return this.timeAvailabilityService.isRecurringTimeAvailable(args)
  }

  @Mutation(() => ReservationType)
  async createReservation(
    @Args() args: CreateReservationArgs,
    @CurrentCustomer() customer: Customer,
  ): Promise<ReservationType> {
    return this.createReservationService.createReservation(args, customer)
  }

  @Mutation(() => CreatedRecurringReservationType)
  createRecurringReservation(
    @Args() args: CreateRecurringReservationArgs,
    @CurrentCustomer() customer: Customer,
  ): Promise<CreatedRecurringReservationType> {
    return this.createReservationService.createRecurringReservation(args, customer)
  }

  @Mutation(() => ReservationType)
  updateReservation(
    @Args() args: UpdateReservationArgs,
    @CurrentCustomer() customer: Customer,
  ): Promise<ReservationType> {
    return this.updateReservationService.updateReservation(args, customer)
  }

  @Query(() => [ReservationType])
  reservations(@Args() args: GetReservationsArgs, @CurrentCustomer() customer: Customer): Promise<ReservationType[]> {
    return this.getReservationService.getReservations(args, customer)
  }
}
