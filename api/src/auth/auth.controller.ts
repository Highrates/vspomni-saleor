import {
  Body,
  Controller,
  Get,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { RegistrationService } from './registration.service';
import {
  AdminLoginDto,
  BuyerLoginDto,
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
  RegisterCompleteDto,
  RegisterStartDto,
  RegisterVerifyDto,
} from './dto/auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { StaffAccessService } from '../staff/staff-access.service';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly registration: RegistrationService,
    private readonly staffAccess: StaffAccessService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('admin/login')
  async adminLogin(@Body() dto: AdminLoginDto) {
    const user = await this.auth.validateAdmin(dto.emailOrPhone, dto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    await this.auth.touchAdminLogin(user.id);
    return this.auth.login(user);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async buyerLogin(@Body() dto: BuyerLoginDto) {
    const user = await this.auth.validateBuyer(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Неверный email или пароль');
    await this.auth.claimGuestOrders(user.id, dto.guestId, user.email);
    return this.auth.login(user);
  }

  /**
   * Шаг 1: email + согласия → OTP (anti-enumeration, cooldown на email).
   * CAPTCHA/Turnstile — подключить на start при росте ботов (Turnstile/hCaptcha).
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register/start')
  registerStart(@Body() dto: RegisterStartDto) {
    return this.registration.start(dto);
  }

  /** Шаг 2: проверка OTP → completionToken (1h). */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register/verify')
  registerVerify(@Body() dto: RegisterVerifyDto) {
    return this.registration.verify(dto);
  }

  /** Шаг 3: пароль + completionToken → User + JWT (jti + user в одной tx). */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register/complete')
  registerComplete(@Body() dto: RegisterCompleteDto) {
    return this.registration.complete(dto);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password-reset/request')
  passwordResetRequest(@Body() dto: PasswordResetRequestDto) {
    return this.auth.requestPasswordReset(dto.email, dto.redirectUrl);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password-reset/confirm')
  passwordResetConfirm(@Body() dto: PasswordResetConfirmDto) {
    return this.auth.confirmPasswordReset(dto.token, dto.password);
  }

  /** Текущий пользователь (buyer или admin). */
  @Get('me')
  async me(@CurrentUser('sub') userId: string) {
    if (!userId) throw new UnauthorizedException();
    const user = await this.auth.me(userId);
    if (!user || !user.isActive) throw new UnauthorizedException();
    return user;
  }

  /** Инвалидирует JWT (tokenVersion++). Клиент всё равно чистит localStorage. */
  @Post('logout')
  async logout(@CurrentUser('sub') userId: string) {
    if (!userId) throw new UnauthorizedException();
    await this.auth.bumpTokenVersion(userId);
    return { ok: true };
  }

  @UseGuards(AdminGuard)
  @Get('admin/me')
  async adminMe(@CurrentUser() jwt: JwtPayload) {
    const userId = jwt.sub;
    const user = await this.auth.me(userId);
    if (
      !user ||
      !user.isActive ||
      (user.role !== UserRole.ADMIN && user.role !== UserRole.MODERATOR)
    ) {
      throw new UnauthorizedException();
    }
    const staff = await this.staffAccess.getStaffContext(userId, user.role, jwt.tv);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      isActive: user.isActive,
      lastAdminLoginAt: user.lastAdminLoginAt,
      createdAt: user.createdAt,
      staff,
    };
  }
}
