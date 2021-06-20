import { ArgsType, Field, ID, InputType, IntersectionType, PartialType, PickType } from '@nestjs/graphql'
import { ReservationType } from '@reservation/dto/reservation.type'
import { CreateReservationArgs } from '@reservation/services/create-reservation/dto/create-reservation.args'
import { Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'

@InputType()
export class UpdatedProperties extends PartialType(
  IntersectionType(
    PickType(ReservationType, ['name', 'startTime', 'endTime', 'isActive'] as const),
    PickType(CreateReservationArgs, ['locations'] as const),
    InputType,
  ),
) {}

@ArgsType()
export class UpdateReservationArgs {
  @Field(() => ID!)
  id: string

  @Field(() => UpdatedProperties)
  @ValidateNested()
  @Type(() => UpdatedProperties)
  updatedProperties: UpdatedProperties

  @Field(() => [ID], { defaultValue: [] })
  connectedUpdates?: string[]
}
