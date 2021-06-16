import { Module } from '@nestjs/common'
import { AuthModule } from './modules/auth/auth.module'
import { CommonModule } from './common/common.module'

@Module({
  imports: [CommonModule, AuthModule],
})
export class AppModule {}
