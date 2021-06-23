import { EmailConfirmationService } from '@auth/services/email-confirmation/email-confirmation.service'
import { CustomerService } from '@customer/customer.service'
import { RegisterTemplate } from '@mailer/templates/register/register.template'
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { InvitationService } from 'src/modules/invitation/invitation.service'
import { MailerService } from 'src/modules/mailer/mailer.service'
import { UserCreatedEvent } from './user-created.event'

@Injectable()
export class UserCreatedListener {
  constructor(
    private readonly mailerService: MailerService,
    private readonly emailConfirmationService: EmailConfirmationService,
    private readonly customerService: CustomerService,
    private readonly invitationService: InvitationService,
  ) {}

  @OnEvent(UserCreatedEvent.name)
  async sendConfirmationEmail(event: UserCreatedEvent): Promise<void> {
    const { name } = event.props
    const user = await this.emailConfirmationService.createEmailConfirmationToken(event.props.user)

    await this.mailerService.sendToUser(RegisterTemplate, user, { user, name })
  }

  @OnEvent(UserCreatedEvent.name)
  async deactivateInvitation(event: UserCreatedEvent): Promise<void> {
    await this.invitationService.deactivateInvitation(event.props.invitationToken)
  }

  @OnEvent(UserCreatedEvent.name)
  async createCustomerProfile(event: UserCreatedEvent): Promise<void> {
    const { user, name } = event.props
    await this.customerService.createCustomer(user, name)
  }
}
