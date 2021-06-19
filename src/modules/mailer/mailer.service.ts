import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { User } from '@prisma/client'
import nodemailer from 'nodemailer'
import SMTPConnection from 'nodemailer/lib/smtp-connection'
import { Template } from './base.template'

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name)

  private transporter: nodemailer.Transporter

  constructor(private readonly config: ConfigService) {}

  async sendToUser<T>(Template: Template<T>, user: User, templateData?: T): Promise<void> {
    this.logger.log(`Sending ${Template.name} template to user ${user.email} (ID: ${user.id})`)
    return this.send(Template, user.email, templateData)
  }

  async sendToAddress<T>(Template: Template<T>, emailAddress: string, templateData?: T): Promise<void> {
    this.logger.log(`Sending ${Template.name} template to address ${emailAddress}`)
    return this.send(Template, emailAddress, templateData)
  }

  async initTransport(): Promise<void> {
    this.logger.log('Initializing...')

    const configuration: SMTPConnection.Options = {
      host: this.config.get<string>('mail.smtp_host'),
      port: this.config.get<number>('mail.smtp_port'),
      secure: this.config.get<boolean>('mail.is_smtp_secure'),
      auth: {
        user: this.config.get<string>('mail.smtp_user'),
        pass: this.config.get<string>('mail.smtp_password'),
      },
    }

    this.transporter = nodemailer.createTransport(configuration)

    try {
      await this.transporter.verify()
      this.logger.log('Ready!')
    } catch (err) {
      this.logger.error('Error while initializing!', err)
      throw err
    }
  }

  private async send<T>(Template: Template<T>, emailAddress: string, templateData?: T): Promise<void> {
    const template = new Template(templateData)

    try {
      const senderEmailAddress = this.config.get<string>('mail.sender_email_address')
      await this.transporter.sendMail({
        to: emailAddress,
        from: senderEmailAddress,
        subject: template.subject,
        html: await template.getHtml(),
      })

      this.logger.log(`Template ${Template.name} has been successfully sent to ${emailAddress}!`)
    } catch (err) {
      this.logger.error(`Could not send ${Template.name} template to address ${emailAddress}!`, err)
      throw err
    }
  }
}
