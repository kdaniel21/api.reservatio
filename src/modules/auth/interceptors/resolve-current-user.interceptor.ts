import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'
import { DomainException } from 'src/common/core/domain-exception'
import { GraphqlContext } from 'src/common/graphql/dto/graphql-context.interface'
import { PrismaService } from 'src/common/services/prisma.service'
import { JwtPayload } from '../services/access-token/dto/jwt-payload.interface'

@Injectable()
export class ResolveCurrentUserInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<any> {
    const ctx: GraphqlContext = GqlExecutionContext.create(context).getContext()

    const redactedUser = ctx.req.user as JwtPayload
    if (!redactedUser) throw new DomainException({ message: 'Request is not authenticated.' })

    const user = await this.prisma.user.findUnique({ where: { id: redactedUser.userId }, include: { customer: true } })
    ctx.req['resolvedUser'] = user

    return next.handle().toPromise()
  }
}
