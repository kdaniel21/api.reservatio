import { Type as ClassType } from '@nestjs/common'
import { Field, ObjectType } from '@nestjs/graphql'
import { PageInfoType } from './page-info.type'
import { Type } from 'class-transformer'
import { Edge, Connection } from '@devoxa/prisma-relay-cursor-connection'

export function PageTypeFactory<T>(NodeType: ClassType<T>) {
  @ObjectType(`${NodeType.name}Edge`)
  class EdgeType implements Edge<T> {
    @Field(() => NodeType)
    @Type(() => NodeType)
    readonly node: T

    @Field()
    readonly cursor: string
  }

  @ObjectType()
  class PageType implements Connection<T> {
    @Field(() => [EdgeType])
    readonly edges: EdgeType[]

    @Field()
    readonly totalCount: number

    @Field(() => PageInfoType)
    readonly pageInfo: PageInfoType
  }

  return PageType
}
