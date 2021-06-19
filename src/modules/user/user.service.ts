import { PrismaService } from '@common/services/prisma.service'
import { Injectable } from '@nestjs/common'
import { Customer, User } from '@prisma/client'

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  getUserById(id: string): Promise<User> {
    return this.prisma.user.findUnique({ where: { id } })
  }

  getCustomerByUser(user: Pick<User, 'id'>): Promise<Customer> {
    return this.prisma.customer.findUnique({ where: { userId: user.id } })
  }
}
