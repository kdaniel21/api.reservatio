import { ConnectionArguments } from '@devoxa/prisma-relay-cursor-connection'
import { ArgsType, Field } from '@nestjs/graphql'
import { Max, Min } from 'class-validator'

@ArgsType()
export class PaginationArgs implements ConnectionArguments {
  @Field()
  @Min(1)
  @Max(100)
  readonly first: number

  @Field({ nullable: true })
  readonly after: string
}
