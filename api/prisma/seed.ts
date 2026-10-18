import { PrismaClient, PromoCodeType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { slugify } from '../src/catalog/slug.util';

const prisma = new PrismaClient();

type Db = PrismaClient;

/** Уникальные категории витрины (без дублей из исходного списка). */
const CATEGORIES = [
  'BB-кремы',
  'CC-кремы',
  'Туши',
  'Наборы декоративной косметики',
  'Бальзамы',
  'Косметички',
  'Косметические карандаши',
  'Румяна',
  'Корректоры',
] as const;

/** Ароматы подтягиваются ETL (Saleor vse-aromaty); seed не создаёт Mira care-stage теги. */
const CATALOG_TAGS = [] as const;

async function seedAdmin(db: Db) {
  const emailRaw = process.env.ADMIN_SEED_EMAIL ?? 'admin@vspomni.store';
  const passwordRaw = process.env.ADMIN_SEED_PASSWORD ?? 'change-me-admin';
  const email = emailRaw.trim().toLowerCase();
  const password = passwordRaw.trim();
  const passwordHash = await bcrypt.hash(password, 10);

  await db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
      displayName: 'Admin',
      staffDisplayName: 'Admin',
    },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
      staffDeletedAt: null,
    },
  });

  console.log(`[seed] Admin ready: ${email}`);
}

async function seedDemoModerator(db: Db) {
  const email = 'moderator@jcos.local';
  const passwordHash = await bcrypt.hash('change-me-moderator', 10);
  await db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      role: UserRole.MODERATOR,
      isActive: true,
      staffDisplayName: 'Демо модератор',
      /**
       * Без catalog — ACL/UX на скидках.
       * Без orders_finance — mark-paid/refund только у суперадмина или с явным grant.
       */
      adminSections: ['orders', 'blog', 'discounts'],
    },
    update: {
      passwordHash,
      role: UserRole.MODERATOR,
      isActive: true,
      staffDeletedAt: null,
      staffDisplayName: 'Демо модератор',
      adminSections: ['orders', 'blog', 'discounts'],
    },
  });
  console.log(`[seed] Demo moderator ready: ${email} / change-me-moderator`);
}

async function seedDemoBuyer(db: Db) {
  const email = 'buyer@jcos.local';
  const passwordHash = await bcrypt.hash('change-me-buyer', 10);
  await db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      role: UserRole.USER,
      isActive: true,
      displayName: 'Демо покупатель',
    },
    update: {
      role: UserRole.USER,
      isActive: true,
      displayName: 'Демо покупатель',
    },
  });
  console.log(`[seed] Demo buyer ready: ${email}`);
}

async function seedCategories(db: Db) {
  for (let i = 0; i < CATEGORIES.length; i++) {
    const name = CATEGORIES[i];
    const slug = slugify(name);
    await db.category.upsert({
      where: { slug },
      create: { name, slug, sortOrder: i },
      update: { name, sortOrder: i },
    });
  }
  console.log(`[seed] Categories: ${CATEGORIES.length} (${CATEGORIES.join(', ')})`);
}

async function seedCatalogTags(db: Db) {
  for (let i = 0; i < CATALOG_TAGS.length; i++) {
    const name = CATALOG_TAGS[i];
    const slug = slugify(name);
    await db.catalogTag.upsert({
      where: { slug },
      create: { name, slug, sortOrder: i },
      update: { name, sortOrder: i },
    });
  }
  console.log(`[seed] Catalog tags: ${CATALOG_TAGS.length} (${CATALOG_TAGS.join(', ')})`);
}

const GIFT_DENOMS = [
  { name: '1000 ₽', faceValue: 1000, validityDays: 365, sortOrder: 0 },
  { name: '2000 ₽', faceValue: 2000, validityDays: 365, sortOrder: 1 },
  { name: '5000 ₽', faceValue: 5000, validityDays: 365, sortOrder: 2 },
  { name: '10000 ₽', faceValue: 10000, validityDays: 365, sortOrder: 3 },
  { name: '20000 ₽', faceValue: 20000, validityDays: 365, sortOrder: 4 },
  { name: '50000 ₽', faceValue: 50000, validityDays: 365, sortOrder: 5 },
] as const;

async function seedUserGroups(db: Db) {
  await db.userGroup.upsert({
    where: { slug: 'guests' },
    create: {
      id: 'ug_default_guest',
      name: 'Гости',
      slug: 'guests',
      isDefaultGuest: true,
      assignable: false,
      allowCatalogDiscounts: true,
      allowPromoCodes: true,
    },
    update: {
      name: 'Гости',
      isDefaultGuest: true,
      assignable: false,
      active: true,
    },
  });
  await db.userGroup.upsert({
    where: { slug: 'retail-registered' },
    create: {
      id: 'ug_default_registered',
      name: 'Розница (зарег.)',
      slug: 'retail-registered',
      isDefaultRegistered: true,
      assignable: false,
      allowCatalogDiscounts: true,
      allowPromoCodes: true,
    },
    update: {
      name: 'Розница (зарег.)',
      isDefaultRegistered: true,
      assignable: false,
      active: true,
    },
  });
  console.log('[seed] User groups: guests + retail-registered');
}

async function seedGiftDenominations(db: Db) {
  const existing = await db.giftCertificateDenomination.count();
  if (existing > 0) {
    console.log(`[seed] Gift denominations: skip (${existing} already)`);
    return;
  }
  for (const d of GIFT_DENOMS) {
    await db.giftCertificateDenomination.create({
      data: { ...d, active: true },
    });
  }
  console.log(`[seed] Gift denominations: ${GIFT_DENOMS.length}`);
}

/** Рабочие промо для smoke (accept + reject). Admin → Промокоды. */
const SEED_PROMOS = [
  {
    code: 'WELCOME10',
    type: PromoCodeType.PERCENT,
    value: 10,
    active: true,
    oneShot: false,
    minOrderAmount: null as number | null,
  },
  {
    code: 'SMOKE500',
    type: PromoCodeType.FIXED,
    value: 500,
    active: true,
    oneShot: false,
    minOrderAmount: 1000,
  },
] as const;

async function seedPromoCodes(db: Db) {
  for (const p of SEED_PROMOS) {
    await db.promoCode.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        type: p.type,
        value: p.value,
        active: p.active,
        oneShot: p.oneShot,
        minOrderAmount: p.minOrderAmount,
        scope: null,
      },
      update: {
        type: p.type,
        value: p.value,
        active: p.active,
        oneShot: p.oneShot,
        minOrderAmount: p.minOrderAmount,
        scope: null,
      },
    });
  }
  console.log(
    `[seed] PromoCodes: ${SEED_PROMOS.map((p) => p.code).join(', ')}`,
  );
}

async function main() {
  // FORCE RLS: seed только с bypass в одной транзакции
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', '', true)`;
      await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`;
      const db = tx as unknown as Db;
      await seedAdmin(db);
      await seedDemoModerator(db);
      await seedDemoBuyer(db);
      await seedCategories(db);
      await seedCatalogTags(db);
      await seedUserGroups(db);
      await seedGiftDenominations(db);
      await seedPromoCodes(db);
    },
    { maxWait: 15_000, timeout: 600_000 },
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
