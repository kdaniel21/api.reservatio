import { SetMetadata } from '@nestjs/common'
import { CustomerRole } from '@prisma/client'

export const CUSTOMER_ROLES_KEY = 'CustomerRoles'

export const CustomerRoles = (...roles: CustomerRole[]) => SetMetadata(CUSTOMER_ROLES_KEY, roles)
