import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'
import { JwtPayload } from '../services/access-token/dto/jwt-payload.interface'

export const Payload = createParamDecorator((data: unknown, context: ExecutionContext): JwtPayload => {
  const ctx = GqlExecutionContext.create(context)
  return ctx.getContext().req.user
})
