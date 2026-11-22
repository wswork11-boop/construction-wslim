import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ChangePasswordRequestSchema,
  LoginRequestSchema,
  LogoutRequestSchema,
  RefreshRequestSchema,
} from '@construction/shared';
import { AuthService } from './auth.service';
import { AuthUser, CurrentUser, Public } from '../common/decorators';
import { parseWithZod } from '../common/zod';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown, @Ip() ip: string) {
    const dto = parseWithZod(LoginRequestSchema, body);
    return this.authService.login(dto, ip);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: unknown) {
    const dto = parseWithZod(RefreshRequestSchema, body);
    return this.authService.refresh(dto);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: unknown) {
    const dto = parseWithZod(LogoutRequestSchema, body);
    await this.authService.logout(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user);
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = parseWithZod(ChangePasswordRequestSchema, body);
    await this.authService.changePassword(user, dto);
  }
}
