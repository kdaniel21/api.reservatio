import { CommonModule } from '@common/common.module'
import { Module, OnApplicationBootstrap } from '@nestjs/common'
import { MailerService } from './mailer.service'

@Module({
  imports: [CommonModule],
  exports: [MailerService],
  providers: [MailerService],
})
export class MailerModule implements OnApplicationBootstrap {
  constructor(private readonly mailerService: MailerService) {}

  async onApplicationBootstrap(): Promise<void> {
    // await this.mailerService.initTransport()
  }
}
