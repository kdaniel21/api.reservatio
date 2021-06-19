import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { applyMiddleware } from './apply-middleware'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  applyMiddleware(app)
  await app.listen(4000)
}

bootstrap()
