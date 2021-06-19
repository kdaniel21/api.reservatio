import { User } from '@prisma/client'

interface UserCreatedEventProps {
  user: User
  invitationToken: string
  name: string
}

export class UserCreatedEvent {
  constructor(readonly props: UserCreatedEventProps) {}
}
