import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { CommonModule } from 'src/common/common.module'
import { CustomerModule } from '../customer/customer.module'
import { MailerModule } from '../mailer/mailer.module'
import { AuthResolver } from './auth.resolver'
import { EmailConfirmationCreatedListener } from './events/email-confirmation-created/email-confirmation-created.listener'
import { PasswordResetCreatedListener } from './events/password-reset-created/password-reset-created.listener'
import { UserCreatedListener } from './events/user-created/user-created.listener'
import { ResolveCurrentCustomerInterceptor } from './interceptors/resolve-current-customer.interceptor'
import { ResolveCurrentUserInterceptor } from './interceptors/resolve-current-user.interceptor'
import { AccessTokenService } from './services/access-token/access-token.service'
import { EmailConfirmationService } from './services/email-confirmation/email-confirmation.service'
import { LoginService } from './services/login/login.service'
import { PasswordResetService } from './services/password-reset/password-reset.service'
import { RefreshTokenService } from './services/refresh-token/refresh-token.service'
import { RegisterService } from './services/register/register.service'
import { JwtStrategy } from './strategies/jwt.strategy'

const jwtFactory = async (configService: ConfigService): Promise<JwtModuleOptions> => ({
  secret: configService.get<string>('auth.jwt_secret'),
  signOptions: { expiresIn: configService.get<string>('auth.jwt_expiration') },
})

const services = [
  LoginService,
  AccessTokenService,
  RefreshTokenService,
  RegisterService,
  EmailConfirmationService,
  PasswordResetService,
]

@Module({
  imports: [
    CommonModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: jwtFactory,
      inject: [ConfigService],
    }),
    MailerModule,
    CustomerModule,
  ],
  exports: [...services],
  providers: [
    ...services,
    AuthResolver,
    JwtStrategy,
    UserCreatedListener,
    EmailConfirmationCreatedListener,
    PasswordResetCreatedListener,
  ],
})
export class AuthModule {}
