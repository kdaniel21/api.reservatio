import { Module } from '@nestjs/common'
import { PrismaService } from './services/prisma.service'
import { GraphqlModule } from './graphql/graphql.module'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ConfigModule } from './config/config.module'

@Module({
  imports: [GraphqlModule, EventEmitterModule.forRoot(), ConfigModule],
  exports: [GraphqlModule, ConfigModule, PrismaService, ConfigModule],
  providers: [PrismaService],
})
export class CommonModule {}
