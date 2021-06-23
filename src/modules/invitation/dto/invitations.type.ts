import { PageTypeFactory } from '@common/graphql/dto/edge.factory'
import { InvitationType } from './invitation.type'

export const InvitationsType = PageTypeFactory(InvitationType)
export type InvitationsType = InstanceType<typeof InvitationsType>
