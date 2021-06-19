import { CommonModule } from '@common/common.module'
import { Module } from '@nestjs/common'
import { UserResolver } from './user.resolver'
import { UserService } from './user.service'

const services = [UserService]

@Module({
  imports: [CommonModule],
  exports: [...services],
  providers: [...services, UserResolver],
})
export class UserModule {}
