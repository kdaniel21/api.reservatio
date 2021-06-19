import { Catch } from '@nestjs/common'
import { GqlExceptionFilter } from '@nestjs/graphql'
import { ApolloError } from 'apollo-server-express'
import { DomainException } from '../core/domain-exception'

@Catch(DomainException)
export class GraphqlExceptionFilter implements GqlExceptionFilter {
  catch(exception: DomainException): ApolloError {
    return new ApolloError(exception.message, exception.code)
  }
}
