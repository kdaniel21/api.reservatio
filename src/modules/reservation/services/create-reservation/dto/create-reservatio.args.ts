import { ArgsType, Field, OmitType } from '@nestjs/graphql'
import { TimeProposalInput } from '@reservation/services/times-availability/dto/time-proposal.input'
import { MaxLength, MinLength } from 'class-validator'

@ArgsType()
export class CreateReservationArgs extends OmitType(TimeProposalInput, ['excludedReservation', 'locations'], ArgsType) {
  @MinLength(3)
  @MaxLength(40)
  @Field()
  readonly name: string

  // @MinDate(new Date())
  // @IsTimeBefore('endTime')
  // @Field()
  // readonly startTime: Date

  // @Field()
  // @MaxHourDifference({ property: 'startTime', hours: 4 })
  // readonly endTime: Date

  // @Field(() => ReservationLocationsInput)
  // @ReservationLocationsValidator()
  // readonly locations: ReservationLocationsInput
}
