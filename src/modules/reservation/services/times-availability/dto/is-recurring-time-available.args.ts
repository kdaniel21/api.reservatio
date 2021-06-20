import { ArgsType, Field, OmitType, registerEnumType } from '@nestjs/graphql'
import { IsFutureDate } from '@reservation/validators/is-future-date.validator'
import { Recurrence } from './recurrence.enum'
import { TimePeriod } from './time-period.enum'
import { TimeProposalInput } from './time-proposal.input'

registerEnumType(Recurrence, { name: 'Recurrence' })
registerEnumType(TimePeriod, { name: 'TimePeriod' })

@ArgsType()
export class IsRecurringTimeAvailableArgs extends OmitType(TimeProposalInput, ['excludedReservation'], ArgsType) {
  @Field(() => [Date], { defaultValue: [] })
  @IsFutureDate({ each: true })
  readonly includedDates?: Date[]

  @Field(() => [Date], { defaultValue: [] })
  readonly excludedDates?: Date[]

  @Field(() => Recurrence, { defaultValue: Recurrence.WEEKLY })
  readonly recurrence: Recurrence

  @Field(() => TimePeriod, { defaultValue: TimePeriod.HALF_YEAR })
  readonly timePeriod: TimePeriod
}
