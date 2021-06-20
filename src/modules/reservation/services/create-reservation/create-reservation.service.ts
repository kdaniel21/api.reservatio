import { PrismaService } from '@common/services/prisma.service'
import { Injectable } from '@nestjs/common'
import { Customer, Reservation } from '@prisma/client'
import { CreateReservationArgs } from './dto/create-reservatio.args'

@Injectable()
export class CreateReservationService {
  constructor(private readonly prisma: PrismaService) {}

  // async createReservation(args: CreateReservationArgs, customer: Customer): Promise<Reservation> {}
}
