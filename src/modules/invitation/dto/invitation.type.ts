import { CustomerType } from '@customer/dto/customer.type'
import { Field, ID, ObjectType } from '@nestjs/graphql'
import { Invitation } from '@prisma/client'
import { IsFutureDate } from '@reservation/validators/is-future-date.validator'
import { IsEmail } from 'class-validator'

@ObjectType()
export class InvitationType implements Partial<Invitation> {
  @Field(() => ID)
  readonly id: string

  @Field()
  @IsFutureDate()
  readonly expiresAt: Date

  readonly inviterId: string

  @Field(() => CustomerType)
  readonly inviter?: CustomerType

  @Field()
  @IsEmail()
  readonly emailAddress: string

  @Field()
  readonly isActive: boolean

  @Field()
  readonly createdAt: Date
}
