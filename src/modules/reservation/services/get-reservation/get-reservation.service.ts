import { PrismaService } from '@common/services/prisma.service'
import { Resolver } from '@nestjs/graphql'
import { Customer, CustomerRole, Reservation } from '@prisma/client'
import { ReservationExceptions } from '../../reservation.exceptions'
import { ReservationService } from '../../reservation.service'
import { GetRecurringReservationsArgs } from './dto/get-recurring-reservations.args'
import { GetReservationArgs } from './dto/get-reservation.args'
import { GetReservationsArgs } from './dto/get-reservations.args'

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

  async getReservations(args: GetReservationsArgs, customer: Customer): Promise<Reservation[]> {
    const reservations =
      customer.role === CustomerRole.ADMIN
        ? await this.getAllReservations(args.startDate, args.endDate)
        : await this.getReservationsForCustomer(args.startDate, args.endDate, customer)

    return reservations
  }

  async getRecurringReservations(args: GetRecurringReservationsArgs, customer: Customer): Promise<Reservation[]> {
    const where: { [key: string]: any } = { recurringId: args.recurringId.toString(), isActive: true }
    if (args.futureOnly) where.startTime = { gte: new Date() }

    const reservations = await this.prisma.reservation.findMany({ where })

    const canAccess = reservations.every((reservation) =>
      this.reservationService.canCustomerAccess(customer, reservation),
    )
    if (!canAccess) throw new ReservationExceptions.ReservationNotAuthorized()

    return reservations
  }

  private getReservationsForCustomer(startDate: Date, endDate: Date, customer: Customer): Promise<Reservation[]> {
    return this.prisma.reservation.findMany({
      where: {
        AND: [
          { AND: [{ startTime: { gte: startDate } }, { startTime: { lt: endDate } }] },
          { isActive: true },
          {
            OR: [{ endTime: { lt: new Date() }, customerId: customer.id.toString() }, { endTime: { gte: new Date() } }],
          },
        ],
      },
    })
  }

  private getAllReservations(startDate: Date, endDate: Date): Promise<Reservation[]> {
    return this.prisma.reservation.findMany({
      where: { AND: [{ startTime: { gte: startDate } }, { startTime: { lte: endDate } }] },
    })
  }
}
