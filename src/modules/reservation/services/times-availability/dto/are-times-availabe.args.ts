import { ArgsType, Field } from '@nestjs/graphql'
import { Type } from 'class-transformer'
import { ArrayNotEmpty, ValidateNested } from 'class-validator'
import { TimeProposalInput } from './time-proposal.input'

@ArgsType()
export class AreTimesAvailableArgs {
  @Field(() => [TimeProposalInput])
  @ValidateNested({ each: true })
  @Type(() => TimeProposalInput)
  @ArrayNotEmpty()
  readonly timeProposals: TimeProposalInput[]
}
