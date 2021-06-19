import { PrismaService } from '@common/services/prisma.service'
import { Resolver } from '@nestjs/graphql'
import { Customer, Reservation } from '@prisma/client'
import { ReservationExceptions } from '../../reservation.exceptions'
import { ReservationService } from '../../reservation.service'
import { GetReservationArgs } from './dto/get-reservation.agrs'

@Resolver()
export class GetReservationService {
  constructor(private readonly prisma: PrismaService, private reservationService: ReservationService) {}

  async getReservationById(args: GetReservationArgs, customer: Customer): Promise<Reservation> {
    const reservation = await this.prisma.reservation.findUnique({ where: { id: args.id } })
    if (!reservation) throw new ReservationExceptions.ReservationNotFound()

    const canAccess = this.reservationService.canCustomerAccess(customer, reservation)
    if (!canAccess) throw new ReservationExceptions.ReservationNotAuthorized()

    return reservation
  }
}
