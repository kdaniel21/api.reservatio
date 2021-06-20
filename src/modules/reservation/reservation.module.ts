import { AuthModule } from '@auth/auth.module'
import { CommonModule } from '@common/common.module'
import { Module } from '@nestjs/common'
import { CustomerModule } from '../customer/customer.module'
import { ReservationResolver } from './reservation.resolver'
import { ReservationService } from './reservation.service'
import { ReservationsResolver } from './reservations.resolver'
// TODO: Create single endpoint for exporting
import { CreateReservationService } from './services/create-reservation/create-reservation.service'
import { GetReservationService } from './services/get-reservation/get-reservation.service'
import { TimesAvailabilityService } from './services/times-availability/times-availability.service'
import { UpdateReservationService } from './services/update-reservation/update-reservation.service'

const services = [
  CreateReservationService,
  GetReservationService,
  ReservationService,
  TimesAvailabilityService,
  UpdateReservationService,
]

@Module({
  imports: [CommonModule, AuthModule, CustomerModule],
  exports: [...services],
  providers: [...services, ReservationsResolver, ReservationResolver],
})
export class ReservationModule {}
