import { PrismaService } from '@common/services/prisma.service'
import { Injectable } from '@nestjs/common'
import { Customer, Reservation } from '@prisma/client'
import { ReservationExceptions } from '@reservation/reservation.exceptions'
import { ReservationService } from '@reservation/reservation.service'
import { addMilliseconds } from 'date-fns'
import { TimeProposalInput } from '../times-availability/dto/time-proposal.input'
import { TimesAvailabilityService } from '../times-availability/times-availability.service'
import { UpdatedProperties, UpdateReservationArgs } from './dto/update-reservation.args'

@Injectable()
export class UpdateReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timesAvailabilityService: TimesAvailabilityService,
    private readonly reservationService: ReservationService,
  ) {}

  async updateReservation(args: UpdateReservationArgs, customer: Customer): Promise<any> {
    const reservationsToUpdate = await this.prisma.reservation.findMany({
      where: { id: { in: [args.id, ...args.connectedUpdates] } },
    })

    let startTimeDifferenceMs: number
    let endTimeDifferenceMs: number

    const { startTime, endTime, ...updatedProperties } = args.updatedProperties
    const reservationsToSave: Reservation[] = reservationsToUpdate.map((reservationToUpdate) => {
      const canUpdateReservation = this.reservationService.canCustomerUpdate(customer, reservationToUpdate)
      if (!canUpdateReservation) throw new ReservationExceptions.ReservationNotAuthorized()

      const isReferenceReservationUpdated = reservationToUpdate.id === args.id
      if (isReferenceReservationUpdated) {
        startTimeDifferenceMs =
          args.updatedProperties.startTime?.getTime() - reservationToUpdate.startTime.getTime() || 0
        endTimeDifferenceMs = args.updatedProperties.endTime?.getTime() - reservationToUpdate.endTime.getTime() || 0
      }

      return {
        ...reservationToUpdate,
        ...updatedProperties,
        ...updatedProperties.locations,
        startTime: addMilliseconds(reservationToUpdate.startTime, startTimeDifferenceMs),
        endTime: addMilliseconds(reservationToUpdate.endTime, endTimeDifferenceMs),
        locations: undefined,
      }
    })

    const shouldReValidateAvailability = this.shouldReValidateAvailability(args.updatedProperties)
    if (shouldReValidateAvailability) {
      const timeProposals: TimeProposalInput[] = reservationsToSave.map((reservationToSave) => ({
        ...reservationToSave,
        locations: { ...reservationToSave },
        excludedReservation: reservationToSave.id,
      }))
      const timeAvailability = await this.timesAvailabilityService.areTimesAvailable(timeProposals)

      const areAllTimesAvailable = timeAvailability.every(({ isAvailable }) => isAvailable)
      if (!areAllTimesAvailable) throw new ReservationExceptions.TimeNotAvailable()
    }

    await this.saveReservations(reservationsToSave)

    return reservationsToSave[0]
  }

  private shouldReValidateAvailability(updatedProperties: UpdateReservationArgs['updatedProperties']): boolean {
    type UpdateKeys = keyof UpdateReservationArgs['updatedProperties']
    const propertiesToReValidate: UpdateKeys[] = ['startTime', 'endTime', 'locations', 'isActive']

    return propertiesToReValidate.some((propertyName) => updatedProperties.hasOwnProperty(propertyName))
  }

  private async saveReservations(reservationsToSave: Reservation[]): Promise<void> {
    const queries = reservationsToSave.map((reservation) =>
      this.prisma.reservation.update({ where: { id: reservation.id }, data: reservation }),
    )
    await this.prisma.$transaction(queries)
  }
}
