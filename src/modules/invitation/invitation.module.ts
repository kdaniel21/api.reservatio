import { AuthModule } from '@auth/auth.module'
import { CommonModule } from '@common/common.module'
import { CustomerModule } from '@customer/customer.module'
import { MailerModule } from '@mailer/mailer.module'
import { Module } from '@nestjs/common'
import { InvitationCreatedListener } from './events/invitation-created/invitation-created.listener'
import { InvitationResolver } from './invitation.resolver'
import { InvitationService } from './invitation.service'

const services = [InvitationService]

@Module({
  imports: [CommonModule, CustomerModule, AuthModule, MailerModule],
  exports: [...services],
  providers: [...services, InvitationResolver, InvitationCreatedListener],
})
export class InvitationModule {}
