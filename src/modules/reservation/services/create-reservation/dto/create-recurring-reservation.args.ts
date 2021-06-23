import { ArgsType, IntersectionType, OmitType, PickType } from '@nestjs/graphql'
import { IsRecurringTimeAvailableArgs } from '@reservation/services/times-availability/dto/is-recurring-time-available.args'
import { CreateReservationArgs } from './create-reservation.args'

@ArgsType()
export class CreateRecurringReservationArgs extends IntersectionType(
  OmitType(IsRecurringTimeAvailableArgs, [] as const),
  PickType(CreateReservationArgs, ['name']),
) {}
