import { Injectable } from '@nestjs/common'
import { Customer, CustomerRole, Reservation } from '@prisma/client'

@Injectable()
export class ReservationService {
  canCustomerAccess(customer: Customer, reservation: Reservation): boolean {
    const isAdmin = customer.role === CustomerRole.ADMIN

    const doesReservationBelongToCustomer = reservation.customerId === customer.id
    const canNormalCustomerAccess = doesReservationBelongToCustomer && reservation.isActive

    return canNormalCustomerAccess || isAdmin
  }
}
