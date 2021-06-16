import { Module } from '@nestjs/common'
import { GraphQLModule } from '@nestjs/graphql'
import { join } from 'path'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [GraphQLModule.forRoot({ autoSchemaFile: true, sortSchema: true })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
