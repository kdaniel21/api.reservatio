import { ObjectType, PartialType } from '@nestjs/graphql'
import { ReservationLocationsInput } from './reservation-locations.input'

@ObjectType()
export class ReservationLocationsType extends PartialType(ReservationLocationsInput, ObjectType) {}
