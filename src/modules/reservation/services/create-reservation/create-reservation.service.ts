import { PrismaService } from '@common/services/prisma.service'
import { TextUtils } from '@common/utils/text-utils'
import { Injectable } from '@nestjs/common'
import { Customer, Prisma, Reservation } from '@prisma/client'
import { ReservationExceptions } from '@reservation/reservation.exceptions'
import { addMinutes, differenceInMinutes } from 'date-fns'
import { TimesAvailabilityService } from '../times-availability/times-availability.service'
import { CreateRecurringReservationArgs } from './dto/create-recurring-reservation.args'
import { CreateReservationArgs } from './dto/create-reservation.args'
import { CreatedRecurringReservationType } from './dto/created-recurring-reservation.type'

@Injectable()
export class CreateReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeAvailabilityService: TimesAvailabilityService,
  ) {}

  async createReservation(args: CreateReservationArgs, customer: Customer): Promise<Reservation> {
    const [timeAvailability] = await this.timeAvailabilityService.areTimesAvailable([args])
    if (!timeAvailability.isAvailable) throw new ReservationExceptions.TimeNotAvailable()

    const {
      locations: { tableTennis, badminton },
      name,
      startTime,
      endTime,
    } = args
    const reservation = this.prisma.reservation.create({
      data: { name, startTime, endTime, customerId: customer.id, badminton, tableTennis },
    })

    return reservation
  }

  async createRecurringReservation(
    args: CreateRecurringReservationArgs,
    customer: Customer,
  ): Promise<CreatedRecurringReservationType> {
    const timeAvailability = await this.timeAvailabilityService.isRecurringTimeAvailable(args)

    const hasUnavailable = !!timeAvailability.unavailableTimes.length
    if (hasUnavailable) throw new ReservationExceptions.TimeNotAvailable()

    const recurringId = TextUtils.generateUuid()
    const minutesDifference = differenceInMinutes(args.endTime, args.startTime)
    type ReservationsToCreate = Prisma.ReservationCreateManyArgs['data']
    const reservationsToCreate: ReservationsToCreate = timeAvailability.availableTimes.map((startTime) => ({
      recurringId,
      name: args.name,
      startTime,
      endTime: addMinutes(startTime, minutesDifference),
      tableTennis: args.locations.tableTennis,
      badminton: args.locations.badminton,
      customerId: customer.id,
    }))

    const { count } = await this.prisma.reservation.createMany({ data: reservationsToCreate })

    return { count, recurringId }
  }
}
