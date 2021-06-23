import { PrismaService } from '@common/services/prisma.service'
import { TextUtils } from '@common/utils/text-utils'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Customer, Invitation, Prisma } from '@prisma/client'
import { addHours } from 'date-fns'
import { CreateInvitationArgs } from './dto/create-invitation.args'
import { InvitationType } from './dto/invitation.type'
import { UpdateInvitationArgs } from './dto/update-invitation.args'
import { InvitationCreatedEvent } from './events/invitation-created/invitation-created.event'
import { InvitationExceptions } from './invitation.exceptions'

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  getInvitations(args: Prisma.InvitationFindManyArgs): Promise<Invitation[]> {
    return this.prisma.invitation.findMany(args)
  }

  getTotalNumOfInvitations(): Promise<number> {
    return this.prisma.invitation.count()
  }

  async createInvitation(args: CreateInvitationArgs, customer: Customer): Promise<InvitationType> {
    const isEmailAlreadyRegistered = await this.isEmailAlreadyRegistered(args.emailAddress)
    if (isEmailAlreadyRegistered) throw new InvitationExceptions.EmailAlreadyRegistered()

    const token = TextUtils.generateUuid()
    const hashedToken = TextUtils.hashText(token)

    const expirationHours = this.config.get<number>('invitation.expiration_hours')
    const expiresAt = addHours(new Date(), expirationHours)

    const invitation = await this.prisma.invitation.create({
      data: {
        emailAddress: args.emailAddress,
        token: hashedToken,
        expiresAt,
        inviterId: customer.id,
      },
    })

    const event = new InvitationCreatedEvent({ invitation, invitationToken: token })
    this.eventEmitter.emit(InvitationCreatedEvent.name, event)

    return invitation
  }

  async deactivateInvitation(unHashedInvitationToken: string): Promise<void> {
    const hashedInvitationToken = TextUtils.hashText(unHashedInvitationToken)

    await this.prisma.invitation.update({ where: { token: hashedInvitationToken }, data: { isActive: false } })
  }

  updateInvitation(args: UpdateInvitationArgs): Promise<Invitation> {
    const { id, ...updatedProperties } = args

    return this.prisma.invitation.update({ where: { id }, data: updatedProperties })
  }

  private async isEmailAlreadyRegistered(emailAddress: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email: emailAddress } })
    return count !== 0
  }
}
