import { EmailConfirmationService } from '@auth/services/email-confirmation/email-confirmation.service'
import { PrismaService } from '@common/services/prisma.service'
import { TextUtils } from '@common/utils/text-utils'
import { RegisterTemplate } from '@mailer/templates/register/register.template'
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { MailerService } from 'src/modules/mailer/mailer.service'
import { UserCreatedEvent } from './user-created.event'

@Injectable()
export class UserCreatedListener {
  constructor(
    private readonly mailerService: MailerService,
    private readonly emailConfirmationService: EmailConfirmationService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(UserCreatedEvent.name)
  async sendConfirmationEmail(event: UserCreatedEvent): Promise<void> {
    const { name } = event.props
    const user = await this.emailConfirmationService.createEmailConfirmationToken(event.props.user)

    await this.mailerService.sendToUser(RegisterTemplate, user, { user, name })
  }

  @OnEvent(UserCreatedEvent.name)
  async deactivateInvitation(event: UserCreatedEvent): Promise<void> {
    // TODO: Call invitationService and deactivate token
    const hashedInvitationToken = TextUtils.hashText(event.props.invitationToken)

    await this.prisma.invitation.update({ where: { token: hashedInvitationToken }, data: { isActive: false } })
  }

  @OnEvent(UserCreatedEvent.name)
  createCustomerProfile(event: UserCreatedEvent): void {}
}
