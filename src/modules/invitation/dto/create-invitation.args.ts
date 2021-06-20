import { ArgsType, PickType } from '@nestjs/graphql'
import { InvitationType } from './invitation.type'

@ArgsType()
export class CreateInvitationArgs extends PickType(InvitationType, ['emailAddress'], ArgsType) {}
