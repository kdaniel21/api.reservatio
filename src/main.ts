import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from './app.module'

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter({ logger: true })

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, fastifyAdapter)

  await app.listen(3000)
}

bootstrap()
