import { Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';
import type { StaffAccessSnapshot } from './staff.types';

export type StaffAccessCacheEntry = {
  at: number;
  data: StaffAccessSnapshot;
};

export interface StaffAccessCacheStore {
  get(userId: string): Promise<StaffAccessCacheEntry | null>;
  set(userId: string, entry: StaffAccessCacheEntry, ttlMs: number): Promise<void>;
  delete(userId: string): Promise<void>;
}

export class InMemoryStaffAccessCache implements StaffAccessCacheStore {
  private readonly map = new Map<string, StaffAccessCacheEntry>();

  async get(userId: string): Promise<StaffAccessCacheEntry | null> {
    return this.map.get(userId) ?? null;
  }

  async set(userId: string, entry: StaffAccessCacheEntry, _ttlMs: number): Promise<void> {
    this.map.set(userId, entry);
  }

  async delete(userId: string): Promise<void> {
    this.map.delete(userId);
  }
}

const REDIS_KEY_PREFIX = 'staff:acl:';

export class RedisStaffAccessCache implements StaffAccessCacheStore, OnModuleDestroy {
  private readonly logger = new Logger(RedisStaffAccessCache.name);
  private readonly client: RedisClientType;
  private connected = false;

  constructor(redisUrl: string) {
    this.client = createClient({ url: redisUrl });
    this.client.on('error', (err) => {
      this.logger.warn(`Redis ACL cache error: ${err instanceof Error ? err.message : err}`);
    });
  }

  async connect(): Promise<boolean> {
    if (this.connected) return true;
    try {
      await this.client.connect();
      this.connected = true;
      this.logger.log('Staff ACL cache: Redis');
      return true;
    } catch (err) {
      this.logger.warn(
        `Staff ACL cache: Redis unavailable (${err instanceof Error ? err.message : err}), fallback in-memory per instance`,
      );
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.connected) return;
    try {
      await this.client.quit();
    } catch {
      /* ignore */
    }
  }

  async get(userId: string): Promise<StaffAccessCacheEntry | null> {
    if (!this.connected) return null;
    try {
      const raw = await this.client.get(`${REDIS_KEY_PREFIX}${userId}`);
      if (!raw) return null;
      return JSON.parse(raw) as StaffAccessCacheEntry;
    } catch (err) {
      this.logger.warn(
        `Redis ACL get failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  async set(userId: string, entry: StaffAccessCacheEntry, ttlMs: number): Promise<void> {
    if (!this.connected) return;
    try {
      const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
      await this.client.set(`${REDIS_KEY_PREFIX}${userId}`, JSON.stringify(entry), {
        EX: ttlSec,
      });
    } catch (err) {
      this.logger.warn(
        `Redis ACL set failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async delete(userId: string): Promise<void> {
    if (!this.connected) return;
    try {
      await this.client.del(`${REDIS_KEY_PREFIX}${userId}`);
    } catch (err) {
      this.logger.warn(
        `Redis ACL delete failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}

/** Redis при REDIS_URL; иначе in-memory (single instance). */
export async function createStaffAccessCacheStore(
  redisUrl: string | undefined,
): Promise<{ store: StaffAccessCacheStore; redis?: RedisStaffAccessCache }> {
  const trimmed = redisUrl?.trim();
  if (!trimmed) {
    return { store: new InMemoryStaffAccessCache() };
  }
  const redis = new RedisStaffAccessCache(trimmed);
  const ok = await redis.connect();
  if (ok) {
    return { store: redis, redis };
  }
  return { store: new InMemoryStaffAccessCache() };
}
