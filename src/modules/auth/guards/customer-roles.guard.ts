import { AuthExceptions } from '@auth/auth.exceptions'
import { CUSTOMER_ROLES_KEY } from '@auth/decorators/customer-roles.decorator'
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { GqlExecutionContext } from '@nestjs/graphql'
import { CustomerRole } from '@prisma/client'

@Injectable()
export class CustomerRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<CustomerRole[]>(CUSTOMER_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!requiredRoles) return true

    const ctx = GqlExecutionContext.create(context).getContext()
    const { user: jwtPayload, resolvedCustomer } = ctx.req

    const hasRole = requiredRoles.some((role) => jwtPayload?.customerRole === role || resolvedCustomer?.role === role)
    if (!hasRole) throw new AuthExceptions.NotAuthorized()

    return true
  }
}
