import { UseGuards, UseInterceptors } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Args, Resolver, Mutation, Query, Context } from '@nestjs/graphql'
import { User } from '@prisma/client'
import { GraphqlContext } from 'src/common/graphql/dto/graphql-context.interface'
import { MessageType } from 'src/common/graphql/dto/message.type'
import { CurrentUser } from './decorators/current-user.decorator'
import { UserType } from '../user/dto/user.type'
import { GqlAuthGuard } from './guards/gql-auth.guard'
import { ResolveCurrentUserInterceptor } from './interceptors/resolve-current-user.interceptor'
import { AccessTokenService } from './services/access-token/access-token.service'
import { AccessTokenType } from './services/access-token/dto/access-token.type'
import { ConfirmEmailAddressArgs } from './services/email-confirmation/dto/confirm-email-address.args'
import { SendEmailConfirmationArgs } from './services/email-confirmation/dto/send-email-confirmation.args'
import { EmailConfirmationService } from './services/email-confirmation/email-confirmation.service'
import { LoginArgs } from './services/login/dto/login.args'
import { LoginType } from './services/login/dto/login.type'
import { LoginService } from './services/login/login.service'
import { ChangePasswordArgs } from './services/password-reset/dto/change-password.args'
import { PasswordResetArgs } from './services/password-reset/dto/password-reset.args'
import { PasswordResetService } from './services/password-reset/password-reset.service'
import { RefreshTokenArgs } from './services/refresh-token/dto/refresh-token.args'
import { RefreshTokenExceptions } from './services/refresh-token/refresh-token.exceptions'
import { RefreshTokenService } from './services/refresh-token/refresh-token.service'
import { RegisterArgs } from './services/register/dto/register.args'
import { RegisterService } from './services/register/register.service'

@Resolver()
export class AuthResolver {
  constructor(
    private readonly loginService: LoginService,
    private readonly registerService: RegisterService,
    private readonly configService: ConfigService,
    private readonly accessTokenService: AccessTokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly emailConfirmationService: EmailConfirmationService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Mutation(() => LoginType)
  async login(@Args() args: LoginArgs, @Context() ctx: GraphqlContext): Promise<LoginType> {
    const { accessToken, refreshToken, unHashedRefreshToken, user } = await this.loginService.login(
      args.email,
      args.password,
    )

    const isProduction = this.configService.get<string>('node.environment') === 'PRODUCTION'
    const cookieOptions = {
      httpOnly: true,
      expires: refreshToken.expiresAt,
      secure: true,
      sameSite: 'none' as const,
    }

    ctx.res.cookie('refresh-token', unHashedRefreshToken, cookieOptions)

    return { accessToken, refreshToken: unHashedRefreshToken, user }
  }

  @Mutation(() => MessageType)
  async register(@Args() args: RegisterArgs): Promise<MessageType> {
    await this.registerService.register(args)

    return {
      message: 'Your user account has been successfully created! Please confirm your email address to log in.',
    }
  }

  @Query(() => AccessTokenType)
  async renewAccessToken(@Args() args: RefreshTokenArgs, @Context() ctx: GraphqlContext): Promise<AccessTokenType> {
    const refreshToken: string = args.refreshToken || ctx.req.cookies['refresh-token']
    if (!refreshToken) throw new RefreshTokenExceptions.InvalidRefreshToken()

    const accessToken = await this.accessTokenService.renewAccessToken(refreshToken)
    return { accessToken }
  }

  @UseGuards(GqlAuthGuard)
  @UseInterceptors(ResolveCurrentUserInterceptor)
  @Query(() => UserType)
  currentUser(@CurrentUser() user: User): UserType {
    return user
  }

  @Mutation(() => MessageType)
  async logout(@Args() args: RefreshTokenArgs, @Context() ctx: GraphqlContext): Promise<MessageType> {
    const refreshToken = args.refreshToken || ctx.req.cookies['refresh-token']
    if (!refreshToken) throw new RefreshTokenExceptions.InvalidRefreshToken()

    await this.refreshTokenService.removeRefreshToken(refreshToken)

    return { message: 'You have been successfully logged out!' }
  }

  @Mutation(() => MessageType)
  async confirmEmailAddress(@Args() args: ConfirmEmailAddressArgs): Promise<MessageType> {
    await this.emailConfirmationService.confirmEmailAddress(args)

    return { message: 'Your email address has been successfully confirmed! Now you can log in.' }
  }

  @Mutation(() => MessageType)
  async sendEmailConfirmation(@Args() args: SendEmailConfirmationArgs): Promise<MessageType> {
    await this.emailConfirmationService.reSendEmailConfirmation(args.email)

    return { message: 'Confirmation email has been successfully re-sent!' }
  }

  @Mutation(() => MessageType)
  async resetPassword(@Args() args: PasswordResetArgs): Promise<MessageType> {
    await this.passwordResetService.createPasswordResetToken(args.email)

    return { message: 'A password reset email has been sent to the email address!' }
  }

  @Mutation(() => MessageType)
  async changePasswordUsingToken(@Args() args: ChangePasswordArgs): Promise<MessageType> {
    await this.passwordResetService.changePasswordUsingToken(args)

    return { message: 'Your password has been changed successfully! Now you can log in.' }
  }

  // TODO: resetPassword, changePasswordUsingToken, confirmEmail, sendEmailConfirmation
  // TODO: Consider breaking it up even more -> some place for invitations etc.
}
