import { Field, ObjectType, OmitType } from '@nestjs/graphql'
import { ReservationLocationsType } from '@reservation/dto/reservation-locations.type'
import { TimeProposalInput } from './time-proposal.input'

@ObjectType()
export class TimeProposalAvailability extends OmitType(
  TimeProposalInput,
  ['excludedReservation', 'locations'],
  ObjectType,
) {
  @Field()
  readonly isAvailable: boolean

  @Field(() => ReservationLocationsType)
  readonly locations: ReservationLocationsType
}
