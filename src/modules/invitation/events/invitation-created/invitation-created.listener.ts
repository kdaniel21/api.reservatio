import { MailerService } from '@mailer/mailer.service'
import { InvitationTemplate } from '@mailer/templates/invitation/invitation.template'
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { InvitationCreatedEvent } from './invitation-created.event'

@Injectable()
export class InvitationCreatedListener {
  constructor(private readonly mailerService: MailerService) {}

  @OnEvent(InvitationCreatedEvent.name)
  async sendInvitationEmail(event: InvitationCreatedEvent): Promise<void> {
    const { invitation, invitationToken } = event.props

    await this.mailerService.sendToAddress(InvitationTemplate, invitation.emailAddress, {
      invitation,
      unHashedToken: invitationToken,
    })
  }
}
