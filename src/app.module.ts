import { Module } from '@nestjs/common'
import { AuthModule } from './modules/auth/auth.module'
import { CommonModule } from './common/common.module'
import { UserModule } from './modules/user/user.module'
import { CustomerModule } from './modules/customer/customer.module'
import { ReservationModule } from './modules/reservation/reservation.module'
import { InvitationModule } from './modules/invitation/invitation.module'

@Module({
  imports: [CommonModule, AuthModule, UserModule, CustomerModule, ReservationModule, InvitationModule],
})
export class AppModule {}
