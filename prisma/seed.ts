import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { addDays } from 'date-fns'
import crypto from 'crypto'

const prisma = new PrismaClient()

export default async () => {
  try {
    await prisma.reservation.deleteMany()
    await prisma.invitation.deleteMany()
    await prisma.refreshToken.deleteMany()
    await prisma.customer.deleteMany()
    await prisma.user.deleteMany()

    const user = await prisma.user.upsert({
      where: { email: 'daniel@reservatio.com' },
      update: {},
      create: {
        email: 'daniel@reservatio.com',
        password: await bcrypt.hash('Test1234', 8),
        isEmailConfirmed: true,
      },
    })

    const customer = await prisma.customer.create({
      data: { name: 'Daniel', userId: user.id },
    })

    await prisma.invitation.create({
      data: {
        emailAddress: 'daniel@reservatio.com',
        expiresAt: addDays(new Date(), 2),
        token: crypto.randomBytes(20).toString('hex'),
        inviterId: customer.id,
      },
    })

    await prisma.reservation.create({
      data: {
        name: 'Test reservation',
        startTime: new Date('2021-07-01 10:00'),
        endTime: new Date('2021-07-01 12:00'),
        badminton: true,
        tableTennis: false,
        customerId: customer.id,
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}
