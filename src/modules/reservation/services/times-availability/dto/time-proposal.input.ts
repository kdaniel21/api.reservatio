import { Field, ID, InputType } from '@nestjs/graphql'
import { ReservationLocationsInput } from '@reservation/dto/reservation-locations.input'
import { HourDifferenceRange } from '@reservation/validators/hour-difference-range.validator'
import { IsFutureDate } from '@reservation/validators/is-future-date.validator'
import { IsTimeBefore } from '@reservation/validators/is-time-before.validator'
import { ReservationLocationsValidator } from '@reservation/validators/reservation-locations.validator'

@InputType()
export class TimeProposalInput {
  @Field()
  @IsFutureDate()
  @IsTimeBefore('endTime')
  readonly startTime: Date

  @Field()
  @IsFutureDate()
  @HourDifferenceRange({ property: 'startTime', min: 0.5, max: 4 })
  readonly endTime: Date

  @Field()
  @ReservationLocationsValidator()
  readonly locations: ReservationLocationsInput

  @Field(() => ID, { nullable: true })
  readonly excludedReservation?: string
}
