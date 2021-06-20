import { PrismaService } from '@common/services/prisma.service'
import { DateUtils } from '@common/utils/date-utils'
import { Injectable } from '@nestjs/common'
import { addMonths } from 'date-fns'
import { isRecurringTimeAvailableArgs } from './dto/is-recurring-time-available.args'
import { Recurrence } from './dto/recurrence.enum'
import { RecurringTimeAvailabilityType } from './dto/recurring-time-availability.type'
import { TimePeriod } from './dto/time-period.enum'
import { TimeProposalAvailability } from './dto/time-proposal-availability.type'
import { TimeProposalInput } from './dto/time-proposal.input'

@Injectable()
export class TimesAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async areTimesAvailable(timeProposals: TimeProposalInput[]): Promise<TimeProposalAvailability[]> {
    const queries = timeProposals.map((proposal) =>
      this.prisma.reservation.count({
        where: {
          startTime: { lt: proposal.endTime },
          endTime: { gt: proposal.startTime },
          OR: [{ tableTennis: proposal.locations.tableTennis }, { badminton: proposal.locations.badminton }],
          id: { not: proposal.excludedReservation },
          isActive: true,
        },
      }),
    )

    const queryResult = await this.prisma.$transaction(queries)
    const results = timeProposals.map((proposal, index) => ({ ...proposal, isAvailable: queryResult[index] === 0 }))
    return results
  }

  async isRecurringTimeAvailable(args: isRecurringTimeAvailableArgs): Promise<RecurringTimeAvailabilityType> {
    const excludedDates = args.excludedDates?.map((date) => date.getTime()) || []
    const recurringDates = this.getDatesWithRecurrence(args.startTime, args.timePeriod, args.recurrence)
    const extendedDates = [...recurringDates, ...args.includedDates]

    const filteredDates = extendedDates.filter((date) => !excludedDates.includes(date.getTime()))

    const timeDifference = args.endTime.getTime() - args.startTime.getTime()
    const plainReservationDates = filteredDates.map((startTime) => ({
      startTime,
      endTime: new Date(startTime.getTime() + timeDifference),
    }))

    const { locations } = args
    const timeProposals: TimeProposalInput[] = plainReservationDates.map((time) => ({ ...time, locations }))

    const timeAvailability = await this.areTimesAvailable(timeProposals)
    const result = { availableTimes: [], unavailableTimes: [] }
    timeAvailability.forEach((time) => {
      time.isAvailable ? result.availableTimes.push(time.startTime) : result.unavailableTimes.push(time.startTime)
    })

    return result
  }

  private getDatesWithRecurrence(startTime: Date, timePeriod: TimePeriod, recurrence: Recurrence): Date[] {
    const lastDate =
      timePeriod === TimePeriod.CURRENT_YEAR ? DateUtils.lastDayOfCurrentYear() : addMonths(new Date(), 6)

    return recurrence === Recurrence.WEEKLY
      ? DateUtils.getWeeklyInterval(startTime, lastDate)
      : DateUtils.getMonthlyInterval(startTime, lastDate)
  }
}
