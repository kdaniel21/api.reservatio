import { MailerService } from '@mailer/mailer.service'
import { PasswordResetTemplate } from '@mailer/templates/password-reset/password-reset.template'
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { PasswordResetCreatedEvent } from './password-reset-created.event'

@Injectable()
export class PasswordResetCreatedListener {
  constructor(private readonly mailerService: MailerService) {}

  @OnEvent(PasswordResetCreatedEvent.name)
  async sendPasswordResetEmail(event: PasswordResetCreatedEvent): Promise<void> {
    const { user, passwordResetToken } = event.props

    await this.mailerService.sendToUser(PasswordResetTemplate, user, { user, passwordResetToken })
  }
}
