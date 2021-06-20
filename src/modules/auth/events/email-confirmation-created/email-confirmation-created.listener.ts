import { MailerService } from '@mailer/mailer.service'
import { ConfirmEmailTemplate } from '@mailer/templates/confirm-email/confirm-email.template'
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { EmailConfirmationCreatedEvent } from './email-confirmation-created.event'

@Injectable()
export class EmailConfirmationCreatedListener {
  constructor(private readonly mailerService: MailerService) {}

  @OnEvent(EmailConfirmationCreatedEvent.name)
  async sendConfirmationEmail(event: EmailConfirmationCreatedEvent): Promise<void> {
    const { user, shouldSendEmail } = event.props
    if (!shouldSendEmail) return

    await this.mailerService.sendToUser(ConfirmEmailTemplate, user, { user })
  }
}
