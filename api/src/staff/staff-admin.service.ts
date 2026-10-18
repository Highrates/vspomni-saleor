import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ADMIN_SECTION_LABELS_RU,
  MODERATOR_ASSIGNABLE_SECTIONS,
  normalizeStoredAdminSections,
  type ModeratorAssignableSectionId,
} from '@vspomni/admin-sections';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { StaffAccessService } from './staff-access.service';
import { StaffMailService } from './staff-mail.service';
import { generateStaffPassword } from './staff-password.util';
import {
  rowFromUser,
  staffDeletedEmail,
  staffUserSelect,
  type StaffAdminRow,
} from './staff.types';

export type { StaffAdminRow, StaffContext } from './staff.types';

@Injectable()
export class StaffAdminService {
  private readonly logger = new Logger(StaffAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly staffAccess: StaffAccessService,
    private readonly mail: StaffMailService,
    private readonly storage: LocalStorageService,
  ) {}

  listSectionCatalog() {
    return {
      assignable: MODERATOR_ASSIGNABLE_SECTIONS.map((id) => ({
        id,
        label: ADMIN_SECTION_LABELS_RU[id] ?? id,
      })),
    };
  }

  async listStaff(): Promise<StaffAdminRow[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.MODERATOR] },
        staffDeletedAt: null,
      },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
      select: staffUserSelect,
    });
    return rows.map(rowFromUser);
  }

  async getStaffSelf(userId: string): Promise<StaffAdminRow> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: staffUserSelect,
    });
    if (
      !user ||
      user.staffDeletedAt ||
      (user.role !== UserRole.ADMIN && user.role !== UserRole.MODERATOR)
    ) {
      throw new NotFoundException('Сотрудник не найден');
    }
    return rowFromUser(user);
  }

  async updateStaffSelf(
    userId: string,
    dto: { staffDisplayName?: string | null },
  ): Promise<StaffAdminRow> {
    return this.updateStaff(userId, userId, dto, { self: true });
  }

  async uploadStaffAvatar(
    actorUserId: string,
    targetUserId: string,
    file: Express.Multer.File,
  ): Promise<StaffAdminRow> {
    if (!file) throw new BadRequestException('Файл не передан');

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, staffDeletedAt: true, staffAvatarUrl: true },
    });
    if (
      !target ||
      target.staffDeletedAt ||
      (target.role !== UserRole.ADMIN && target.role !== UserRole.MODERATOR)
    ) {
      throw new NotFoundException('Сотрудник не найден');
    }

    if (actorUserId !== targetUserId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorUserId },
        select: { role: true },
      });
      if (actor?.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Только суперадмин может менять аватар другого сотрудника');
      }
    }

    const { url } = await this.storage.saveImage(file, `staff/${targetUserId}`);
    if (target.staffAvatarUrl) {
      await this.storage.deleteByPublicUrl(target.staffAvatarUrl).catch(() => false);
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { staffAvatarUrl: url },
      select: staffUserSelect,
    });

    this.staffAccess.invalidateStaffAccessCache(targetUserId);
    return rowFromUser(updated);
  }

  async createStaff(
    actorUserId: string,
    dto: {
      email: string;
      staffDisplayName?: string;
      adminSections: ModeratorAssignableSectionId[];
    },
  ): Promise<{ user: StaffAdminRow; emailSent: boolean; temporaryPassword?: string }> {
    const email = dto.email.trim().toLowerCase();
    if (!email) throw new BadRequestException('Email обязателен');

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (
        (existing.role === UserRole.ADMIN || existing.role === UserRole.MODERATOR) &&
        !existing.staffDeletedAt
      ) {
        throw new BadRequestException('Сотрудник с таким email уже существует');
      }
      throw new BadRequestException(
        'Email уже используется клиентским аккаунтом. Укажите другой адрес.',
      );
    }

    const sections = this.ensureNonEmptyAssignableSections(dto.adminSections);
    const password = generateStaffPassword();
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: UserRole.MODERATOR,
        isActive: true,
        staffDisplayName: dto.staffDisplayName?.trim() || null,
        adminSections: sections,
      },
      select: staffUserSelect,
    });

    this.logger.log(
      JSON.stringify({
        kind: 'staff_created',
        actorUserId,
        entityId: user.id,
        email,
        adminSections: sections,
      }),
    );

    let emailSent = false;
    try {
      const delivery = await this.mail.sendStaffAdminWelcome({
        to: email,
        password,
        loginUrl: this.mail.resolveAdminLoginUrl(),
        staffDisplayName: user.staffDisplayName,
      });
      emailSent = delivery.delivered;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Staff welcome email failed for ${email}: ${msg}`);
    }

    return {
      user: rowFromUser(user),
      emailSent,
      ...(emailSent ? {} : { temporaryPassword: password }),
    };
  }

  async updateStaff(
    actorUserId: string,
    id: string,
    dto: {
      staffDisplayName?: string | null;
      adminSections?: ModeratorAssignableSectionId[];
      isActive?: boolean;
    },
    opts?: { self?: boolean },
  ): Promise<StaffAdminRow> {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: staffUserSelect,
    });
    if (
      !current ||
      current.staffDeletedAt ||
      (current.role !== UserRole.ADMIN && current.role !== UserRole.MODERATOR)
    ) {
      throw new NotFoundException('Сотрудник не найден');
    }

    if (opts?.self) {
      if (actorUserId !== id) {
        throw new ForbiddenException('Можно редактировать только свой профиль');
      }
      if (dto.adminSections !== undefined || dto.isActive !== undefined) {
        throw new BadRequestException('Недоступно для самостоятельного редактирования');
      }
    }

    // UI не даёт менять статус ADMIN; API тоже запрещает (не только «последнего»).
    if (dto.isActive !== undefined && current.role === UserRole.ADMIN) {
      throw new ForbiddenException('Нельзя менять статус суперадмина');
    }

    const data: {
      staffDisplayName?: string | null;
      adminSections?: string[];
      isActive?: boolean;
      tokenVersion?: { increment: number };
    } = {};

    if (dto.staffDisplayName !== undefined) {
      data.staffDisplayName = dto.staffDisplayName?.trim() || null;
    }
    if (dto.adminSections !== undefined) {
      if (current.role === UserRole.ADMIN) {
        throw new BadRequestException('Разделы суперадмина не настраиваются');
      }
      data.adminSections = this.ensureNonEmptyAssignableSections(dto.adminSections);
      // tokenVersion++ + invalidateStaffAccessCache — JWT и Redis/in-memory ACL на всех нодах.
      data.tokenVersion = { increment: 1 };
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
      if (dto.isActive === false) {
        data.tokenVersion = { increment: 1 };
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: staffUserSelect,
    });

    this.logger.log(
      JSON.stringify({
        kind: dto.isActive === false ? 'staff_deactivated' : 'staff_updated',
        actorUserId,
        entityId: id,
        self: Boolean(opts?.self),
        before: {
          isActive: current.isActive,
          adminSections: normalizeStoredAdminSections(current.adminSections),
        },
        after: {
          isActive: updated.isActive,
          adminSections: normalizeStoredAdminSections(updated.adminSections),
        },
      }),
    );

    this.staffAccess.invalidateStaffAccessCache(id);
    return rowFromUser(updated);
  }

  async resetPassword(
    actorUserId: string,
    id: string,
  ): Promise<{ emailSent: boolean; temporaryPassword?: string }> {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        email: true,
        isActive: true,
        staffDeletedAt: true,
        staffDisplayName: true,
      },
    });
    if (
      !current ||
      current.staffDeletedAt ||
      (current.role !== UserRole.ADMIN && current.role !== UserRole.MODERATOR)
    ) {
      throw new NotFoundException('Сотрудник не найден');
    }
    if (!current.isActive) {
      throw new BadRequestException('Нельзя сбросить пароль деактивированному сотруднику');
    }
    if (!current.email?.trim()) {
      throw new BadRequestException('У сотрудника не задан email для отправки пароля');
    }

    const password = generateStaffPassword();
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });

    this.logger.log(
      JSON.stringify({
        kind: 'staff_password_reset',
        actorUserId,
        entityId: id,
        email: current.email,
      }),
    );

    let emailSent = false;
    try {
      const delivery = await this.mail.sendStaffAdminPasswordReset({
        to: current.email.trim(),
        password,
        loginUrl: this.mail.resolveAdminLoginUrl(),
        staffDisplayName: current.staffDisplayName,
      });
      emailSent = delivery.delivered;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Staff password reset email failed for ${current.email}: ${msg}`);
    }

    this.staffAccess.invalidateStaffAccessCache(id);
    return {
      emailSent,
      ...(emailSent ? {} : { temporaryPassword: password }),
    };
  }

  async deleteStaff(actorUserId: string, id: string): Promise<void> {
    if (actorUserId === id) {
      throw new BadRequestException('Нельзя удалить свою учётную запись');
    }

    const current = await this.prisma.user.findUnique({
      where: { id },
      select: staffUserSelect,
    });
    if (!current || current.role !== UserRole.MODERATOR || current.staffDeletedAt) {
      throw new NotFoundException('Сотрудник не найден');
    }

    if (current.staffAvatarUrl) {
      await this.storage.deleteByPublicUrl(current.staffAvatarUrl).catch(() => false);
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        // role → USER: сброс staffDeletedAt сам по себе не вернёт staff ACL
        role: UserRole.USER,
        isActive: false,
        staffDeletedAt: new Date(),
        email: staffDeletedEmail(id),
        passwordHash: null,
        staffDisplayName: null,
        staffAvatarUrl: null,
        adminSections: [],
        tokenVersion: { increment: 1 },
      },
    });

    this.logger.log(
      JSON.stringify({
        kind: 'staff_deleted',
        actorUserId,
        entityId: id,
        previousEmail: current.email,
      }),
    );

    this.staffAccess.invalidateStaffAccessCache(id);
  }

  private ensureNonEmptyAssignableSections(
    raw: readonly ModeratorAssignableSectionId[],
  ): ModeratorAssignableSectionId[] {
    const sections = normalizeStoredAdminSections(raw);
    if (sections.length === 0) {
      throw new BadRequestException('Выберите хотя бы один раздел');
    }
    return sections;
  }
}
