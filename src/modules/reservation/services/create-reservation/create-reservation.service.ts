import { PrismaService } from '@common/services/prisma.service'
import { Injectable } from '@nestjs/common'

@Injectable()
export class CreateReservationService {
  constructor(private readonly prisma: PrismaService) {}
}
