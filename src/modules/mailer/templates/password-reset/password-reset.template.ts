import { BaseTemplate } from '@mailer/base.template'
import { User } from '@prisma/client'

export interface PasswordResetTemplateData {
  user: User
  passwordResetToken: string
}

export class PasswordResetTemplate extends BaseTemplate<PasswordResetTemplateData> {
  constructor(readonly templateData: PasswordResetTemplateData) {
    super()
  }

  readonly subject = 'Reset your password'
  readonly path = './password-reset/password-reset.hbs'
}
