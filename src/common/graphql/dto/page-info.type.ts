import { PageInfo } from '@devoxa/prisma-relay-cursor-connection'
import { Field, ObjectType } from '@nestjs/graphql'

@ObjectType()
export class PageInfoType implements PageInfo {
  @Field({ nullable: true })
  readonly startCursor?: string

  @Field({ nullable: true })
  readonly endCursor?: string

  @Field()
  readonly hasPreviousPage: boolean

  @Field()
  readonly hasNextPage: boolean
}
