import { Invitation } from '@prisma/client'
import { BaseTemplate } from '@mailer/base.template'

export interface InvitationTemplateData {
  invitation: Invitation
}

export class InvitationTemplate extends BaseTemplate<InvitationTemplateData> {
  constructor(readonly templateData: InvitationTemplateData) {
    super()
  }

  readonly subject = 'Invitation to Reservatio'
  readonly path = './invitation/invitation.hbs'
}
