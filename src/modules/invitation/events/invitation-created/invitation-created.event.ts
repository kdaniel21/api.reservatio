import { Invitation } from '@prisma/client'

// TODO: Maybe somehow avoid this interface?
interface InvitationCreatedEventProps {
  invitation: Invitation
  invitationToken: string
}

export class InvitationCreatedEvent {
  constructor(readonly props: InvitationCreatedEventProps) {}
}
