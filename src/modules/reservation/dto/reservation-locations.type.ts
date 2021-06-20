import { ObjectType, PickType } from '@nestjs/graphql'
import { ReservationLocationsInput } from './reservation-locations.input'

@ObjectType()
export class ReservationLocationsType extends PickType(
  ReservationLocationsInput,
  ['badminton', 'tableTennis'],
  ObjectType,
) {}
