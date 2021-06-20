import { PrismaService } from '@common/services/prisma.service'
import { Injectable } from '@nestjs/common'
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
}
