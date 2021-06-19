import { PrismaService } from '@common/services/prisma.service'
import { Injectable } from '@nestjs/common'
import { Customer, CustomerRole, User } from '@prisma/client'

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  createCustomer(user: User, name: string): Promise<Customer> {
    return this.prisma.customer.create({
      data: { userId: user.id, name, role: CustomerRole.CUSTOMER },
    })
  }

  getCustomerByUserId(userId: string): Promise<Customer> {
    return this.prisma.customer.findUnique({ where: { userId } })
  }

  getCustomerById(id: string): Promise<Customer> {
    return this.prisma.customer.findUnique({ where: { id } })
  }
}
