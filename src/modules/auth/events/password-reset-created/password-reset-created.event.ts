import { User } from '@prisma/client'

interface PasswordResetCreatedEventProps {
  user: User
  passwordResetToken: string
}

export class PasswordResetCreatedEvent {
  constructor(readonly props: PasswordResetCreatedEventProps) {}
}
