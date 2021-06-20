import { Field, ID, ObjectType } from '@nestjs/graphql'
import { Reservation } from '@prisma/client'
import { CustomerType } from '@customer/dto/customer.type'
import { ReservationLocationsType } from './reservation-locations.type'
import { IsFutureDate } from '@reservation/validators/is-future-date.validator'
import { IsTimeBefore } from '@reservation/validators/is-time-before.validator'
import { HourDifferenceRange } from '@reservation/validators/hour-difference-range.validator'
import { MaxLength, MinLength } from 'class-validator'

@ObjectType()
export class ReservationType implements Partial<Reservation> {
  @Field(() => ID)
  readonly id: string

  @Field(() => ID, { nullable: true })
  readonly recurringId?: string

  @Field()
  @MinLength(3)
  @MaxLength(40)
  readonly name: string

  @Field()
  readonly isActive: boolean

  readonly customerId: string

  @Field(() => CustomerType)
  readonly customer?: CustomerType

  @Field()
  @IsFutureDate()
  @IsTimeBefore('endTime')
  readonly startTime: Date

  @Field()
  @IsFutureDate()
  @HourDifferenceRange({ property: 'startTime', min: 0.5, max: 4 })
  readonly endTime: Date

  readonly badminton: boolean
  readonly tableTennis: boolean

  @Field(() => ReservationLocationsType)
  readonly locations?: ReservationLocationsType

  @Field()
  readonly createdAt: Date

  @Field()
  readonly updatedAt: Date
}
