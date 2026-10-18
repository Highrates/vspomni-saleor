/**
 * Проставляет ProductVariant.onecId из CommerceML offers.xml по артикулу/штрихкоду.
 *
 * Мэтч: Артикул или Штрихкод из XML ↔ ProductVariant.sku (точное совпадение).
 * Уже заполненный onecId не трогаем, кроме --force.
 *
 * Запуск из backend/:
 *   npx ts-node --transpile-only prisma/fill-onec-ids-from-offers.ts path/to/offers.xml
 *   npx ts-node --transpile-only prisma/fill-onec-ids-from-offers.ts path/to/offers.xml --dry-run
 *   npx ts-node --transpile-only prisma/fill-onec-ids-from-offers.ts path/to/offers.xml --force
 *
 * Также: npm run prisma:fill-onec-ids -- ../path/offers.xml --dry-run
 */
import { existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { PrismaClient } from '@prisma/client';
import { parseOffersXml } from '../src/onec/onec-offers.parser';

/** backend/.env — Prisma CLI не подхватывает его в ts-node скриптах автоматически */
function loadBackendEnv() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadBackendEnv();
const prisma = new PrismaClient();

function normalizeKey(s: string): string {
  return s.trim().replace(/\s+/g, '');
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const fileArg = args.find((a) => !a.startsWith('--'));

  if (!fileArg) {
    console.error(
      'Usage: ts-node prisma/fill-onec-ids-from-offers.ts <offers.xml> [--dry-run] [--force]',
    );
    process.exit(1);
  }

  const xmlPath = resolve(process.cwd(), fileArg);
  const xml = readFileSync(xmlPath, 'utf8');
  const offers = parseOffersXml(xml);
  console.log(`XML: ${xmlPath}`);
  console.log(`Offers: ${offers.length}${dryRun ? ' (dry-run)' : ''}${force ? ' (force)' : ''}`);

  const bySku = new Map<string, { onecId: string; label: string }>();
  let dupInXml = 0;
  for (const o of offers) {
    const keys = [o.sku, o.barcode]
      .filter((x): x is string => Boolean(x?.trim()))
      .map(normalizeKey);
    const uniqueKeys = [...new Set(keys)];
    for (const key of uniqueKeys) {
      const prev = bySku.get(key);
      if (prev && prev.onecId !== o.onecId) {
        dupInXml += 1;
        console.warn(
          `  warn: SKU/barcode ${key} maps to different onecId (${prev.onecId} vs ${o.onecId}) — keep first`,
        );
        continue;
      }
      bySku.set(key, {
        onecId: o.onecId,
        label: o.name || o.sku || o.barcode || o.onecId,
      });
    }
  }
  console.log(`Unique SKU/barcode keys from XML: ${bySku.size}`);

  const variants = await prisma.productVariant.findMany({
    select: {
      id: true,
      sku: true,
      onecId: true,
      name: true,
      product: { select: { name: true } },
    },
  });

  let matched = 0;
  let updated = 0;
  let skippedHasOnec = 0;
  let skippedConflict = 0;
  let unmatchedVariants = 0;
  const usedOnecIds = new Set(
    variants.map((v) => v.onecId).filter((x): x is string => Boolean(x)),
  );

  for (const v of variants) {
    const hit = bySku.get(normalizeKey(v.sku));
    if (!hit) {
      unmatchedVariants += 1;
      continue;
    }
    matched += 1;

    if (v.onecId && !force) {
      if (v.onecId !== hit.onecId) {
        console.warn(
          `  skip (already set): ${v.sku} has onecId=${v.onecId}, xml=${hit.onecId}`,
        );
      }
      skippedHasOnec += 1;
      continue;
    }

    if (v.onecId === hit.onecId) {
      skippedHasOnec += 1;
      continue;
    }

    if (usedOnecIds.has(hit.onecId) && v.onecId !== hit.onecId) {
      const owner = variants.find((x) => x.onecId === hit.onecId);
      console.warn(
        `  conflict: onecId ${hit.onecId} already on variant sku=${owner?.sku ?? '?'} — skip ${v.sku}`,
      );
      skippedConflict += 1;
      continue;
    }

    console.log(
      `  ${dryRun ? 'would set' : 'set'} ${v.sku} → ${hit.onecId} (${v.product.name} / ${v.name})`,
    );

    if (!dryRun) {
      await prisma.productVariant.update({
        where: { id: v.id },
        data: { onecId: hit.onecId },
      });
      if (v.onecId) usedOnecIds.delete(v.onecId);
      usedOnecIds.add(hit.onecId);
    }
    updated += 1;
  }

  const xmlKeysMatched = new Set<string>();
  for (const v of variants) {
    const key = normalizeKey(v.sku);
    if (bySku.has(key)) xmlKeysMatched.add(key);
  }
  const xmlOrphans = [...bySku.keys()].filter((k) => !xmlKeysMatched.has(k));

  console.log('\n--- summary ---');
  console.log(`variants total:     ${variants.length}`);
  console.log(`matched by sku:     ${matched}`);
  console.log(`updated:            ${updated}`);
  console.log(`skipped (has id):   ${skippedHasOnec}`);
  console.log(`skipped (conflict): ${skippedConflict}`);
  console.log(`variants no match:  ${unmatchedVariants}`);
  console.log(`xml keys no variant:${xmlOrphans.length}`);
  if (xmlOrphans.length && xmlOrphans.length <= 30) {
    for (const k of xmlOrphans) {
      console.log(`  unmatched xml key: ${k} → ${bySku.get(k)?.onecId}`);
    }
  } else if (xmlOrphans.length > 30) {
    console.log(`  (first 20)`);
    for (const k of xmlOrphans.slice(0, 20)) {
      console.log(`  unmatched xml key: ${k} → ${bySku.get(k)?.onecId}`);
    }
  }
  if (dupInXml) console.log(`xml duplicate warnings: ${dupInXml}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
