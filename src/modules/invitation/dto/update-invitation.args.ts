import { ArgsType, IntersectionType, OmitType, PartialType, PickType } from '@nestjs/graphql'
import { InvitationType } from './invitation.type'

@ArgsType()
export class UpdateInvitationArgs extends IntersectionType(
  PickType(InvitationType, ['id'] as const),
  PartialType(OmitType(InvitationType, ['inviter', 'inviterId', 'createdAt', 'id'] as const)),
  ArgsType,
) {}
