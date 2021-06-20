import { AuthExceptions } from '@auth/auth.exceptions'
import { JwtPayload } from '@auth/services/access-token/dto/jwt-payload.interface'
import { DomainException } from '@common/core/domain-exception'
import { GraphqlContext } from '@common/graphql/dto/graphql-context.interface'
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'
import { CustomerService } from 'src/modules/customer/customer.service'

// TODO: Create decorator that replaces GqlAuthGuard + interceptor
@Injectable()
export class ResolveCurrentCustomerInterceptor implements NestInterceptor {
  constructor(private readonly customerService: CustomerService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<any> {
    const ctx: GraphqlContext = GqlExecutionContext.create(context).getContext()

    const redactedUser = ctx.req.user as JwtPayload
    if (!redactedUser) throw new DomainException({ message: 'Request is not authenticated.' })
    if (!redactedUser.customerId) throw new AuthExceptions.InvalidCustomer()

    const customer = await this.customerService.getCustomerById(redactedUser.customerId)
    if (!customer) throw new AuthExceptions.InvalidCustomer()

    ctx.req['resolvedCustomer'] = customer

    return next.handle().toPromise()
  }
}
