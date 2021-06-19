import { CommonModule } from '@common/common.module'
import { Module } from '@nestjs/common'
import { UserModule } from '../user/user.module'
import { CustomerResolver } from './customer.resolver'
import { CustomerService } from './customer.service'

const services = [CustomerService]

@Module({
  imports: [CommonModule, UserModule],
  exports: [...services],
  providers: [...services, CustomerResolver],
})
export class CustomerModule {}
