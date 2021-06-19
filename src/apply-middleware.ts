import { INestApplication, ValidationPipe } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import { GraphqlExceptionFilter } from './common/graphql/graphql-exception.filter'
import { validationExceptionFactory } from './common/graphql/validation-exception-factory'

export function applyMiddleware(app: INestApplication) {
  app.useGlobalPipes(new ValidationPipe({ exceptionFactory: validationExceptionFactory }))
  app.useGlobalFilters(new GraphqlExceptionFilter())

  app.use(cookieParser())
}
