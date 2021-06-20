import { DateUtils } from '@common/utils/date-utils'
import { ArgsType, Field } from '@nestjs/graphql'
import { HourDifferenceRange } from '@reservation/validators/hour-difference-range.validator'
import { IsTimeBefore } from '@reservation/validators/is-time-before.validator'
import { Transform } from 'class-transformer'
import { addDays } from 'date-fns'

@ArgsType()
export class GetReservationsArgs {
  @Field()
  @Transform(({ value }) => DateUtils.removeTime(value))
  @IsTimeBefore('endDate')
  readonly startDate: Date

  @Field()
  @Transform(({ value }) => DateUtils.removeTime(addDays(value, 1)))
  @HourDifferenceRange({ property: 'startDate', min: 24, max: 7 * 24 })
  readonly endDate: Date
}
