import { Parent, ResolveField, Resolver } from '@nestjs/graphql'
import { CustomerService } from '../customer/customer.service'
import { CustomerType } from '../customer/dto/customer.type'
import { ReservationLocationType } from './dto/reservation-location.type'
import { ReservationType } from './dto/reservation.type'

// TODO: Possibly merge with ReservationsResolver
@Resolver(() => ReservationType)
export class ReservationResolver {
  constructor(private readonly customerService: CustomerService) {}

  @ResolveField()
  locations(@Parent() reservation: ReservationType): ReservationLocationType {
    const { badminton, tableTennis } = reservation
    return { badminton, tableTennis }
  }

  @ResolveField(() => CustomerType)
  customer(@Parent() reservation: ReservationType): Promise<CustomerType> {
    return this.customerService.getCustomerById(reservation.customerId)
  }
}
