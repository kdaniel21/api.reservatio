import { Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { readFileSync } from 'fs'
import yaml from 'js-yaml'
import { join } from 'path'

const YAML_CONFIG_FILENAME = 'config.yaml'

const configuration = () =>
  yaml.load(readFileSync(join(process.cwd(), YAML_CONFIG_FILENAME), 'utf-8')) as Record<string, any>

@Module({
  imports: [NestConfigModule.forRoot({ load: [configuration] })],
  exports: [NestConfigModule],
})
export class ConfigModule {}
