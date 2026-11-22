import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import {
  ChangePasswordRequest,
  LoginRequest,
  LogoutRequest,
  RefreshRequest,
} from '@construction/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/errors';
import { hashOpaqueToken, hashPassword, verifyPassword } from '../common/password';
import { AuthUser } from '../common/decorators';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private serializeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone ?? null,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
      updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : user.updatedAt,
    };
  }

  private async issueTokenPair(user: any, deviceName?: string, tx?: any) {
    const client = tx || this.prisma;
    const secret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'dev-access-secret-do-not-use-in-prod';
    const expiresInSeconds = 900; // 15 minutes (AC2)
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role, jti: crypto.randomUUID() },
      { secret, expiresIn: expiresInSeconds },
    );

    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    const refreshTtlDays = Number(this.configService.get('JWT_REFRESH_TTL_DAYS') || 30);
    const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

    await client.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        deviceName: deviceName ?? null,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: expiresInSeconds,
    };
  }

  async login(dto: LoginRequest, ip?: string) {
    const email = dto.email.toLowerCase().trim();
    const windowStart = new Date(Date.now() - 15 * 60 * 1000);

    // AC1: 5 failures in 15 minutes locks further attempts for that email for 15 minutes
    const recentFailures = await this.prisma.loginAttempt.count({
      where: {
        email,
        success: false,
        createdAt: { gte: windowStart },
      },
    });

    if (recentFailures >= 5) {
      throw AppException.tooManyRequests(
        'LOGIN_LOCKED',
        'Too many failed attempts. Try again in 15 minutes',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      await this.prisma.loginAttempt.create({
        data: { email, success: false, ip: ip ?? null },
      });
      throw AppException.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const valid = await verifyPassword(dto.password, user.passwordHash);
    if (!valid) {
      await this.prisma.loginAttempt.create({
        data: { email, success: false, ip: ip ?? null },
      });
      throw AppException.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    await this.prisma.loginAttempt.create({
      data: { email, success: true, ip: ip ?? null },
    });

    const tokens = await this.issueTokenPair(user, dto.deviceName);
    return {
      ...tokens,
      user: this.serializeUser(user),
    };
  }

  async refresh(dto: RefreshRequest) {
    const tokenHash = hashOpaqueToken(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !stored ||
      stored.revokedAt !== null ||
      stored.expiresAt.getTime() <= Date.now() ||
      !stored.user ||
      !stored.user.isActive
    ) {
      throw AppException.unauthorized(
        'INVALID_REFRESH_TOKEN',
        'Refresh token is invalid, expired, or revoked',
      );
    }

    return this.prisma.$transaction(async (tx: any) => {
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      return this.issueTokenPair(stored.user, stored.deviceName ?? undefined, tx);
    });
  }

  async logout(dto: LogoutRequest) {
    const tokenHash = hashOpaqueToken(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (stored && stored.revokedAt === null) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  async getMe(user: AuthUser) {
    return this.serializeUser(user);
  }

  async changePassword(user: AuthUser, dto: ChangePasswordRequest) {
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      throw AppException.notFound('NOT_FOUND', 'User not found');
    }
    const valid = await verifyPassword(dto.currentPassword, dbUser.passwordHash);
    if (!valid) {
      throw AppException.unprocessable(
        'CURRENT_PASSWORD_INCORRECT',
        'Current password does not match',
      );
    }

    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }
}
