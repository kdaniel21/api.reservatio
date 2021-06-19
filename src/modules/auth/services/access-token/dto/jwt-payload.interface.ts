import { CustomerRole } from '@prisma/client'

export interface JwtPayload {
  userId: string
  email: string
  customerId?: string
  customerRole?: CustomerRole
}
