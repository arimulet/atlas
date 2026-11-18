import { createHash, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { z } from "zod";
import type { PersistedMarketTransfer } from "./types.js";

const PREFIX = "atlas:market:transfers";
const METADATA_KEY = `${PREFIX}:metadata`;
const LOCK_KEY = `${PREFIX}:rebuild-lock`;
const MAX_BLOCK_BYTES = 8_000_000;
const MAX_WIRE_BYTES = 9_000_000;
const metadataSchema = z.object({
  status: z.enum(["ready", "updating"]),
  changeCounter: z.string().min(1),
  updatedAt: z.string(),
  transferCount: z.number().int().nonnegative(),
  blockCount: z.number().int().nonnegative().max(10000),
  hashes: z.array(z.string().regex(/^[a-f0-9]{64}$/))
});
type CacheMetadata = z.infer<typeof metadataSchema>;

export interface MarketTransferCacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  listBlocks(): Promise<string[]>;
  acquireLock(key: string, token: string): Promise<boolean>;
  releaseLock(key: string, token: string): Promise<unknown>;
  publishIfLocked(key: string, token: string, metadata: string): Promise<boolean>;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function splitMarketTransferBlocks(
  transfers: readonly PersistedMarketTransfer[],
  maxBytes = MAX_BLOCK_BYTES
): string[] {
  const blocks: string[] = [];
  let entries: string[] = [];
  let rawBytes = 2;
  let wireBytes = 2;
  for (const transfer of transfers) {
    const entry = JSON.stringify(transfer);
    const rawSize = Buffer.byteLength(entry);
    const wireSize = Buffer.byteLength(JSON.stringify(entry)) - 2;
    if (rawSize + 2 > maxBytes || wireSize + 2 > MAX_WIRE_BYTES)
      throw new Error("Market transfer exceeds cache block size");
    if (
      entries.length &&
      (rawBytes + rawSize + 1 > maxBytes || wireBytes + wireSize + 1 > MAX_WIRE_BYTES)
    ) {
      blocks.push(`[${entries.join(",")}]`);
      entries = [];
      rawBytes = 2;
      wireBytes = 2;
    }
    const separator = entries.length ? 1 : 0;
    entries.push(entry);
    rawBytes += rawSize + separator;
    wireBytes += wireSize + separator;
  }
  if (entries.length) blocks.push(`[${entries.join(",")}]`);
  return blocks;
}

function parseMetadata(value: string | null): CacheMetadata | null {
  if (!value) return null;
  try {
    const parsed = metadataSchema.safeParse(JSON.parse(value));
    return parsed.success && parsed.data.hashes.length === parsed.data.blockCount
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}

function restoreTransfers(blocks: string[]): PersistedMarketTransfer[] {
  return blocks.flatMap((block) => {
    const entries: unknown = JSON.parse(block);
    if (!Array.isArray(entries)) throw new Error("Invalid transfer block");
    return entries.map((entry: Record<string, unknown>) => {
      if (!entry || typeof entry !== "object" || typeof entry.transferDate !== "string")
        throw new Error("Invalid cached transfer");
      const transferDate = new Date(entry.transferDate);
      if (Number.isNaN(transferDate.getTime())) throw new Error("Invalid cached transfer date");
      return {
        ...entry,
        transferDate,
        ...(typeof entry.createdAt === "string" ? { createdAt: new Date(entry.createdAt) } : {}),
        ...(typeof entry.updatedAt === "string" ? { updatedAt: new Date(entry.updatedAt) } : {})
      } as PersistedMarketTransfer;
    });
  });
}

export class MarketTransferCache {
  private local: { counter: string; transfers: PersistedMarketTransfer[] } | null = null;
  constructor(private readonly client: MarketTransferCacheClient) {}

  clearLocal(): void {
    this.local = null;
  }

  async read(): Promise<PersistedMarketTransfer[] | null> {
    const started = performance.now();
    try {
      const before = parseMetadata(await this.client.get(METADATA_KEY));
      if (!before || before.status !== "ready") return null;
      if (this.local?.counter === before.changeCounter) {
        console.info(
          `[MarketTransferCache] local hit in ${Math.round(performance.now() - started)}ms`
        );
        return this.local.transfers;
      }
      const blocks = await Promise.all(
        before.hashes.map((_, index) => this.client.get(`${PREFIX}:block:${index}`))
      );
      if (blocks.some((block, index) => block === null || hash(block) !== before.hashes[index]))
        return null;
      const after = parseMetadata(await this.client.get(METADATA_KEY));
      if (!after || after.status !== "ready" || JSON.stringify(before) !== JSON.stringify(after))
        return null;
      const transfers = restoreTransfers(blocks as string[]);
      if (transfers.length !== before.transferCount) return null;
      this.local = { counter: before.changeCounter, transfers };
      console.info(
        `[MarketTransferCache] read ${transfers.length} transfers in ${Math.round(performance.now() - started)}ms`
      );
      return transfers;
    } catch (error) {
      console.warn(
        "[MarketTransferCache] read failed; using MongoDB",
        error instanceof Error ? error.name : "unknown error"
      );
      return null;
    }
  }

  async rebuild(loadTransfers: () => Promise<PersistedMarketTransfer[]>): Promise<boolean> {
    const started = performance.now();
    const lockToken = randomUUID();
    let hasLock = false;
    try {
      hasLock = await this.client.acquireLock(LOCK_KEY, lockToken);
      if (!hasLock) return false;
      const previous = parseMetadata(await this.client.get(METADATA_KEY));
      const previousCount = previous?.blockCount ?? 0;
      const updating: CacheMetadata = {
        status: "updating",
        changeCounter: randomUUID(),
        updatedAt: new Date().toISOString(),
        transferCount: 0,
        blockCount: previousCount,
        hashes: Array(previousCount).fill("0".repeat(64))
      };
      await this.client.set(METADATA_KEY, JSON.stringify(updating));
      this.local = null;
      const existingBlocks = await this.client.listBlocks();
      for (const key of existingBlocks) await this.client.del(key);
      const transfers = await loadTransfers();
      const blocks = splitMarketTransferBlocks(transfers);
      const cleanupCount = Math.max(previousCount, blocks.length);
      await this.client.set(
        METADATA_KEY,
        JSON.stringify({
          ...updating,
          blockCount: cleanupCount,
          hashes: Array(cleanupCount).fill("0".repeat(64))
        })
      );
      for (let index = 0; index < blocks.length; index++)
        await this.client.set(`${PREFIX}:block:${index}`, blocks[index]!);
      const expectedHashes = blocks.map(hash);
      for (let index = 0; index < blocks.length; index++) {
        const saved = await this.client.get(`${PREFIX}:block:${index}`);
        if (saved === null || hash(saved) !== expectedHashes[index])
          throw new Error("Market transfer block verification failed");
      }
      const ready: CacheMetadata = {
        status: "ready",
        changeCounter: randomUUID(),
        updatedAt: new Date().toISOString(),
        transferCount: transfers.length,
        blockCount: blocks.length,
        hashes: expectedHashes
      };
      if (!(await this.client.publishIfLocked(LOCK_KEY, lockToken, JSON.stringify(ready))))
        throw new Error("Market transfer cache rebuild lock expired");
      console.info(
        `[MarketTransferCache] rebuilt ${transfers.length} transfers in ${blocks.length} blocks (${blocks.reduce((sum, block) => sum + Buffer.byteLength(block), 0)} bytes) in ${Math.round(performance.now() - started)}ms`
      );
      return true;
    } catch (error) {
      console.warn(
        "[MarketTransferCache] rebuild failed; using MongoDB",
        error instanceof Error ? error.name : "unknown error"
      );
      return false;
    } finally {
      if (hasLock) {
        try {
          await this.client.releaseLock(LOCK_KEY, lockToken);
        } catch {
          console.warn("[MarketTransferCache] could not release rebuild lock");
        }
      }
    }
  }
}

let cache: MarketTransferCache | null | undefined;
export function getMarketTransferCache(): MarketTransferCache | null {
  if (cache !== undefined) return cache;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return (cache = null);
  try {
    const redis = new Redis({ url, token, automaticDeserialization: false });
    return (cache = new MarketTransferCache({
      get: (key) => redis.get<string>(key),
      set: (key, value) => redis.set(key, value),
      del: (...keys) => redis.del(...keys),
      listBlocks: async () => {
        let cursor = "0";
        const keys = new Set<string>();
        do {
          const [next, batch] = await redis.scan(cursor, {
            match: `${PREFIX}:block:*`,
            count: 100
          });
          cursor = String(next);
          for (const key of batch)
            if (/^atlas:market:transfers:block:\d+$/.test(key)) keys.add(key);
        } while (cursor !== "0");
        return [...keys];
      },
      acquireLock: async (key, token) =>
        (await redis.set(key, token, { nx: true, px: 300_000 })) === "OK",
      releaseLock: (key, token) =>
        redis.eval(
          "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
          [key],
          [token]
        ),
      publishIfLocked: async (key, token, metadata) =>
        (await redis.eval<string[], number>(
          "if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[2], ARGV[2]); return 1 else return 0 end",
          [key, METADATA_KEY],
          [token, metadata]
        )) === 1
    }));
  } catch (error) {
    console.warn(
      "[MarketTransferCache] invalid configuration; using MongoDB",
      error instanceof Error ? error.name : "unknown error"
    );
    return (cache = null);
  }
}
