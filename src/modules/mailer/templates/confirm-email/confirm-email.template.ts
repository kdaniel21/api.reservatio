import { User } from '@prisma/client'
import { BaseTemplate } from '../../base.template'

export interface ConfirmEmailTemplateData {
  user: User
}

export class ConfirmEmailTemplate extends BaseTemplate<ConfirmEmailTemplateData> {
  constructor(readonly templateData: ConfirmEmailTemplateData) {
    super()
  }

  readonly subject = 'Confirm your email address!'
  protected readonly path = 'confirm-email/confirm-email.hbs'
}
