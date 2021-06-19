import { User } from '@prisma/client'

interface EmailConfirmationCreatedEventProps {
  user: User
  shouldSendEmail: boolean
}

export class EmailConfirmationCreatedEvent {
  constructor(readonly props: EmailConfirmationCreatedEventProps) {}
}
