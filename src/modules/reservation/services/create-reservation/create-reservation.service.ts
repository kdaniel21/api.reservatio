import { PrismaService } from '@common/services/prisma.service'
import { Injectable } from '@nestjs/common'
import { Customer, Reservation } from '@prisma/client'
import { TimesAvailabilityService } from '../times-availability/times-availability.service'
import { CreateReservationExceptions } from './create-reservation.exceptions'
import { CreateReservationArgs } from './dto/create-reservation.args'

@Injectable()
export class CreateReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeAvailabilityService: TimesAvailabilityService,
  ) {}

  async createReservation(args: CreateReservationArgs, customer: Customer): Promise<Reservation> {
    const [timeAvailability] = await this.timeAvailabilityService.areTimesAvailable([args])
    if (!timeAvailability.isAvailable) throw new CreateReservationExceptions.TimeNotAvailable()

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
}
