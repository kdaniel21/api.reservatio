import { ArgsType, OmitType } from '@nestjs/graphql'
import { InvitationType } from './invitation.type'

@ArgsType()
export class UpdateInvitationArgs extends OmitType(InvitationType, ['inviter', 'inviterId', 'createdAt'], ArgsType) {}
