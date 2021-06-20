import { Field, IntersectionType, ObjectType, OmitType, PickType } from '@nestjs/graphql'
import { ReservationType } from '@reservation/dto/reservation.type'
import { TimeProposalInput } from './time-proposal.input'

@ObjectType()
export class TimeProposalAvailability extends IntersectionType(
  OmitType(TimeProposalInput, ['excludedReservation', 'locations']),
  PickType(ReservationType, ['locations'] as const),
  ObjectType,
) {
  @Field()
  readonly isAvailable: boolean
}
