const { PrismaClient } = require('@prisma/client')
const util = require('util')
const clearAllData = require('./clear-all-data')
const exec = util.promisify(require('child_process').exec)

console.log('root', process.cwd())
const prismaBinary = `${process.cwd()}/node_modules/.bin/prisma`

const databaseUrl = 'postgresql://postgres:postgres@localhost:5432/reservatio'
process.env.DATABASE_URL = databaseUrl

module.exports = async () => {
  const prisma = new PrismaClient()
  const schema = 'test'

  const [{ exists: doesSchemaExist }] = await prisma.$queryRaw(
    `SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = '${schema}');`,
  )

  const url = `${databaseUrl}?schema=${schema}`
  process.env.DATABASE_URL = url

  if (!doesSchemaExist) {
    await prisma.$executeRaw(`create schema if not exists "${schema}"`)
    await exec(`${prismaBinary} db push --preview-feature`)
  } else {
    await clearAllData()
  }

  await prisma.$disconnect()
}
