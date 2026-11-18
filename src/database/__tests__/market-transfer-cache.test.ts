import { describe, expect, it, vi } from "vitest";
import {
  MarketTransferCache,
  splitMarketTransferBlocks,
  type MarketTransferCacheClient
} from "../repositories/market-transfer-cache.js";
import { filterCachedTransfers } from "../repositories/marketTransferRepository.js";
import type { PersistedMarketTransfer } from "../repositories/types.js";

function transfer(id: number, profile: string | null = "defender"): PersistedMarketTransfer {
  return {
    transferKey: String(id),
    playerId: id,
    name: `Júgador ${id}`,
    transferDate: new Date(`2026-01-0${id}T00:00:00Z`),
    gameWeek: 100,
    season: 7,
    week: 1,
    salePrice: 1,
    age: 20,
    skills: { pace: 10 },
    profile
  };
}

function createMockClient() {
  const values = new Map<string, string>();
  const mockClient: MarketTransferCacheClient = {
    get: vi.fn(async (key) => values.get(key) ?? null),
    set: vi.fn(async (key, value) => {
      values.set(key, value);
    }),
    del: vi.fn(async (...keys) => {
      keys.forEach((key) => values.delete(key));
    }),
    listBlocks: vi.fn(async () =>
      [...values.keys()].filter((key) => key.startsWith("atlas:market:transfers:block:"))
    ),
    acquireLock: vi.fn(async (key, token) => {
      if (values.has(key)) return false;
      values.set(key, token);
      return true;
    }),
    releaseLock: vi.fn(async (key, token) => {
      if (values.get(key) === token) values.delete(key);
    }),
    publishIfLocked: vi.fn(async (key, token, metadata) => {
      if (values.get(key) !== token) return false;
      values.set("atlas:market:transfers:metadata", metadata);
      return true;
    })
  };
  return { mockClient, values };
}

describe("shared market transfer cache", () => {
  it("splits blocks by UTF-8 bytes and preserves records", () => {
    const items = [transfer(1), transfer(2), transfer(3)];
    const blocks = splitMarketTransferBlocks(items, 300);

    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks.every((block) => Buffer.byteLength(block) <= 300)).toBe(true);
    expect(blocks.flatMap((block) => JSON.parse(block))).toHaveLength(3);
  });

  it("reuses a local copy until metadata changes and preserves dates", async () => {
    const { mockClient } = createMockClient();
    const writer = new MarketTransferCache(mockClient);
    const reader = new MarketTransferCache(mockClient);
    await writer.rebuild(async () => [transfer(1)]);

    const first = await reader.read();
    const second = await reader.read();
    await writer.rebuild(async () => [transfer(2)]);
    const changed = await reader.read();

    expect(first?.[0]?.transferDate).toEqual(transfer(1).transferDate);
    expect(second).toBe(first);
    expect(changed?.[0]?.playerId).toBe(2);
  });

  it("rejects missing, damaged and concurrently changed blocks", async () => {
    const { mockClient, values } = createMockClient();
    const writer = new MarketTransferCache(mockClient);
    await writer.rebuild(async () => [transfer(1)]);
    const blockKey = "atlas:market:transfers:block:0";
    const block = values.get(blockKey)!;
    values.delete(blockKey);
    expect(await new MarketTransferCache(mockClient).read()).toBeNull();
    values.set(blockKey, `${block} `);
    expect(await new MarketTransferCache(mockClient).read()).toBeNull();
    values.set(blockKey, block);
    let metadataReads = 0;
    const changingClient: MarketTransferCacheClient = {
      ...mockClient,
      get: async (key) => {
        const value = values.get(key) ?? null;
        if (key.endsWith(":metadata") && ++metadataReads === 2 && value) {
          return JSON.stringify({ ...JSON.parse(value), changeCounter: "changed" });
        }
        return value;
      }
    };
    expect(await new MarketTransferCache(changingClient).read()).toBeNull();
  });

  it("does not publish a partial cache when two rebuilds overlap", async () => {
    const { mockClient } = createMockClient();
    const first = new MarketTransferCache(mockClient);
    const second = new MarketTransferCache(mockClient);
    let finishLoad!: (records: PersistedMarketTransfer[]) => void;
    const loading = new Promise<PersistedMarketTransfer[]>((resolve) => {
      finishLoad = resolve;
    });
    const rebuilding = first.rebuild(() => loading);
    await vi.waitFor(() => expect(mockClient.listBlocks).toHaveBeenCalledOnce());

    expect(await second.rebuild(async () => [transfer(2)])).toBe(false);
    expect(await new MarketTransferCache(mockClient).read()).toBeNull();
    finishLoad([transfer(1)]);
    expect(await rebuilding).toBe(true);
    expect((await second.read())?.[0]?.playerId).toBe(1);
  });

  it("leaves interrupted rebuilds unavailable and repairs them on the next job", async () => {
    const { mockClient, values } = createMockClient();
    const writer = new MarketTransferCache(mockClient);
    await writer.rebuild(async () => [transfer(1)]);

    expect(
      await writer.rebuild(async () => {
        throw new Error("failed");
      })
    ).toBe(false);
    expect(await new MarketTransferCache(mockClient).read()).toBeNull();
    expect(await writer.rebuild(async () => [])).toBe(true);
    expect(await new MarketTransferCache(mockClient).read()).toEqual([]);
    expect(values.has("atlas:market:transfers:block:0")).toBe(false);
  });

  it("does not reuse local data when Redis is unavailable", async () => {
    const { mockClient } = createMockClient();
    const reader = new MarketTransferCache(mockClient);
    await reader.rebuild(async () => [transfer(1)]);
    await reader.read();
    vi.mocked(mockClient.get).mockRejectedValueOnce(new Error("unavailable"));

    expect(await reader.read()).toBeNull();
  });

  it("filters cached records by date and profile, including legacy fallback", () => {
    const items = [transfer(3, "forward"), transfer(2, "defender"), transfer(1, null)];
    expect(filterCachedTransfers(items, new Date("2026-01-02T12:00:00Z"))).toEqual(items.slice(1));
    expect(filterCachedTransfers(items, new Date("2026-01-04"), 1)).toEqual([items[1], items[0]]);
    expect(filterCachedTransfers([items[2]!], new Date("2026-01-04"), 1)).toEqual([items[2]]);
  });
});
