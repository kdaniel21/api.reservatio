import { Field, ID, InputType, OmitType } from '@nestjs/graphql'
import { CreateReservationArgs } from '@reservation/services/create-reservation/dto/create-reservation.args'

@InputType()
export class TimeProposalInput extends OmitType(CreateReservationArgs, ['name'], InputType) {
  @Field(() => ID, { nullable: true })
  readonly excludedReservation?: string
}
