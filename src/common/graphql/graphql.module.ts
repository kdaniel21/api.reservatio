import { Module } from '@nestjs/common'
import { GraphQLModule } from '@nestjs/graphql'
import path from 'path'

@Module({
  imports: [
    GraphQLModule.forRoot({
      autoSchemaFile: true,
      cors: { credentials: true, origin: true },
      context: ({ req, res }) => ({ req, res }),
      playground: {
        settings: {
          'request.credentials': 'include',
        },
      },
    }),
  ],
  exports: [GraphQLModule],
})
export class GraphqlModule {}
