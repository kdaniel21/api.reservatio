import { BaseTemplate } from '@mailer/base.template'
import { User } from '@prisma/client'

export interface RegisterTemplateData {
  user: User
  name: string
}

export class RegisterTemplate extends BaseTemplate<RegisterTemplateData> {
  constructor(readonly templateData: RegisterTemplateData) {
    super()
  }

  readonly subject = 'Welcome onboard!'
  readonly path = './register/register.hbs'
}
