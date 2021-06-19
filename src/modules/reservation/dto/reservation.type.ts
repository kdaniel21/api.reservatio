import { Field, ID, ObjectType } from '@nestjs/graphql'
import { Reservation } from '@prisma/client'
import { CustomerType } from '@customer/dto/customer.type'
import { ReservationLocationType } from './reservation-location.type'

@ObjectType()
export class ReservationType implements Partial<Reservation> {
  @Field(() => ID)
  readonly id: string

  @Field(() => ID, { nullable: true })
  readonly recurringId?: string

  @Field()
  readonly name: string

  @Field()
  readonly isActive: boolean

  readonly customerId: string

  @Field(() => CustomerType)
  readonly customer?: CustomerType

  @Field()
  readonly startTime: Date

  @Field()
  readonly endTime: Date

  readonly badminton: boolean
  readonly tableTennis: boolean

  @Field(() => ReservationLocationType)
  readonly locations?: ReservationLocationType

  @Field()
  readonly createdAt: Date

  @Field()
  readonly updatedAt: Date
}
