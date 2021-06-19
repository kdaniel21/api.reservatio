import { Module } from '@nestjs/common'
import { AuthModule } from './modules/auth/auth.module'
import { CommonModule } from './common/common.module'
import { UserModule } from './modules/user/user.module'
import { CustomerModule } from './modules/customer/customer.module'
import { ReservationModule } from './modules/reservation/reservation.module'

@Module({
  imports: [CommonModule, AuthModule, UserModule, CustomerModule, ReservationModule],
})
export class AppModule {}
