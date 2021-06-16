import { Module } from '@nestjs/common'
import { GraphQLModule } from '@nestjs/graphql'
import { PrismaService } from './services/prisma.service'

@Module({
  imports: [GraphQLModule.forRoot({ autoSchemaFile: true, sortSchema: true })],
  exports: [GraphQLModule],
  providers: [PrismaService],
})
export class CommonModule {}
