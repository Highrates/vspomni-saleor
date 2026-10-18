import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '@prisma/client';
import { StaffAdminService } from './staff-admin.service';

function makePrisma() {
  return {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  };
}

describe('StaffAdminService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: StaffAdminService;
  const staffAccess = {
    invalidateStaffAccessCache: vi.fn(),
  };
  const mail = {
    resolveAdminLoginUrl: vi.fn(() => 'http://localhost:3000/admin/login'),
    sendStaffAdminWelcome: vi.fn(async () => ({ delivered: false })),
    sendStaffAdminPasswordReset: vi.fn(async () => ({ delivered: false })),
  };
  const storage = {
    saveImage: vi.fn(),
    deleteByPublicUrl: vi.fn(),
  };

  beforeEach(() => {
    prisma = makePrisma();
    vi.clearAllMocks();
    svc = new StaffAdminService(
      prisma as never,
      staffAccess as never,
      mail as never,
      storage as never,
    );
  });

  it('createStaff создаёт MODERATOR и шлёт welcome', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const created = {
      id: 'm1',
      email: 'mod@jcos.local',
      role: UserRole.MODERATOR,
      isActive: true,
      staffDisplayName: 'Mod',
      staffAvatarUrl: null,
      adminSections: ['catalog'],
      lastAdminLoginAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    prisma.user.create.mockResolvedValue(created);

    const res = await svc.createStaff('admin1', {
      email: 'mod@jcos.local',
      staffDisplayName: 'Mod',
      adminSections: ['catalog'],
    });

    expect(res.user.role).toBe(UserRole.MODERATOR);
    expect(res.emailSent).toBe(false);
    expect(res.temporaryPassword).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]{14}$/);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: UserRole.MODERATOR,
          email: 'mod@jcos.local',
          adminSections: ['catalog'],
        }),
      }),
    );
    expect(mail.sendStaffAdminWelcome).toHaveBeenCalled();
  });

  it('deleteStaff soft-delete: staffDeletedAt + email + bump token', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'm1',
      email: 'mod@jcos.local',
      role: UserRole.MODERATOR,
      isActive: true,
      staffDisplayName: 'Mod',
      staffAvatarUrl: 'http://127.0.0.1:3001/uploads/staff/m1/a.jpg',
      adminSections: ['catalog'],
      lastAdminLoginAt: null,
      createdAt: new Date(),
      staffDeletedAt: null,
    });
    prisma.user.update.mockResolvedValue({});
    storage.deleteByPublicUrl = vi.fn().mockResolvedValue(true);

    await svc.deleteStaff('admin1', 'm1');

    expect(storage.deleteByPublicUrl).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/uploads/staff/m1/a.jpg',
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm1' },
        data: expect.objectContaining({
          role: UserRole.USER,
          isActive: false,
          staffDeletedAt: expect.any(Date),
          passwordHash: null,
          email: expect.stringContaining('staff-deleted-m1'),
          tokenVersion: { increment: 1 },
        }),
      }),
    );
  });

  const activeModerator = {
    id: 'm1',
    email: 'mod@jcos.local',
    role: UserRole.MODERATOR,
    isActive: true,
    staffDisplayName: 'Mod',
    staffAvatarUrl: null,
    adminSections: ['catalog', 'orders'],
    lastAdminLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    staffDeletedAt: null,
  };

  it('getStaffSelf возвращает профиль активного модератора', async () => {
    prisma.user.findUnique.mockResolvedValue(activeModerator);

    const row = await svc.getStaffSelf('m1');

    expect(row.id).toBe('m1');
    expect(row.adminSections).toEqual(['catalog', 'orders']);
  });

  it('getStaffSelf — 404 для удалённого сотрудника', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...activeModerator,
      staffDeletedAt: new Date(),
    });

    await expect(svc.getStaffSelf('m1')).rejects.toMatchObject({
      message: 'Сотрудник не найден',
    });
  });

  it('updateStaffSelf обновляет отображаемое имя', async () => {
    prisma.user.findUnique.mockResolvedValue(activeModerator);
    prisma.user.update.mockResolvedValue({
      ...activeModerator,
      staffDisplayName: 'Новое имя',
    });

    const row = await svc.updateStaffSelf('m1', { staffDisplayName: 'Новое имя' });

    expect(row.staffDisplayName).toBe('Новое имя');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm1' },
        data: expect.objectContaining({ staffDisplayName: 'Новое имя' }),
      }),
    );
  });

  it('updateStaffSelf запрещает менять adminSections и isActive', async () => {
    prisma.user.findUnique.mockResolvedValue(activeModerator);

    await expect(
      svc.updateStaff('m1', 'm1', { adminSections: ['blog'] }, { self: true }),
    ).rejects.toMatchObject({
      message: 'Недоступно для самостоятельного редактирования',
    });
    await expect(
      svc.updateStaff('m1', 'm1', { isActive: false }, { self: true }),
    ).rejects.toMatchObject({
      message: 'Недоступно для самостоятельного редактирования',
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('resetPassword для self инвалидирует сессию и шлёт email', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'm1',
      role: UserRole.MODERATOR,
      email: 'mod@jcos.local',
      isActive: true,
      staffDeletedAt: null,
      staffDisplayName: 'Mod',
    });
    prisma.user.update.mockResolvedValue({});

    const res = await svc.resetPassword('m1', 'm1');

    expect(res.emailSent).toBe(false);
    expect(res.temporaryPassword).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]{14}$/);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm1' },
        data: expect.objectContaining({
          passwordHash: expect.any(String),
          tokenVersion: { increment: 1 },
        }),
      }),
    );
    expect(mail.sendStaffAdminPasswordReset).toHaveBeenCalled();
    expect(staffAccess.invalidateStaffAccessCache).toHaveBeenCalledWith('m1');
  });

  it('uploadStaffAvatar — self без роли ADMIN', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'm1',
      role: UserRole.MODERATOR,
      staffDeletedAt: null,
      staffAvatarUrl: null,
    });
    storage.saveImage = vi.fn().mockResolvedValue({ url: 'http://127.0.0.1:3001/uploads/staff/m1/new.jpg' });
    prisma.user.update.mockResolvedValue({
      ...activeModerator,
      staffAvatarUrl: 'http://127.0.0.1:3001/uploads/staff/m1/new.jpg',
    });

    const file = { buffer: Buffer.from('x'), mimetype: 'image/jpeg' } as Express.Multer.File;
    const row = await svc.uploadStaffAvatar('m1', 'm1', file);

    expect(row.staffAvatarUrl).toBe('http://127.0.0.1:3001/uploads/staff/m1/new.jpg');
    expect(storage.saveImage).toHaveBeenCalledWith(file, 'staff/m1');
  });

  it('updateStaff запрещает менять isActive у ADMIN', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'a2',
      email: 'other@jcos.local',
      role: UserRole.ADMIN,
      isActive: true,
      staffDisplayName: 'Other',
      staffAvatarUrl: null,
      adminSections: [],
      lastAdminLoginAt: null,
      createdAt: new Date(),
      staffDeletedAt: null,
    });

    await expect(
      svc.updateStaff('admin1', 'a2', { isActive: false }),
    ).rejects.toMatchObject({
      message: 'Нельзя менять статус суперадмина',
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
