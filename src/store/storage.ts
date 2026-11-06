import type AsyncStorage from '@react-native-async-storage/async-storage';

/** The slice of AsyncStorage the stores depend on. */
export type StorageLike = Pick<
  typeof AsyncStorage,
  'getItem' | 'setItem' | 'removeItem'
>;

/**
 * Wraps storage so persistence is best effort: a failed read looks like an
 * empty key and a failed write is ignored. The in-memory state stays
 * authoritative for the session.
 */
export function safeStorage(storage: StorageLike) {
  return {
    getItem: async (key: string): Promise<string | null> => {
      try {
        return await storage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: async (key: string, value: string): Promise<void> => {
      try {
        await storage.setItem(key, value);
      } catch {
        // Persistence is best effort.
      }
    },
    removeItem: async (key: string): Promise<void> => {
      try {
        await storage.removeItem(key);
      } catch {
        // Persistence is best effort.
      }
    },
  };
}

type SafeStorage = ReturnType<typeof safeStorage>;

/**
 * Zustand `persist` stores `{ state, version }`, while the pre-migration stores
 * wrote bare arrays (`[holding, ...]` / `[symbol, ...]`). This adapter upgrades
 * a legacy value once, on read, so existing local data survives the migration.
 *
 * Anything that already looks like a Zustand envelope is passed through
 * untouched. Malformed values become an empty state, which the store's `merge`
 * validator then replaces with its default.
 */
export function withLegacyFormat(
  storage: SafeStorage,
  wrap: (legacy: unknown) => Record<string, unknown>,
): SafeStorage {
  return {
    ...storage,
    getItem: async (key: string): Promise<string | null> => {
      const raw = await storage.getItem(key);
      if (raw === null) {
        return null;
      }

      try {
        const parsed: unknown = JSON.parse(raw);
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed) &&
          'state' in parsed
        ) {
          return raw;
        }
        return JSON.stringify({ state: wrap(parsed), version: 1 });
      } catch {
        return JSON.stringify({ state: wrap(undefined), version: 1 });
      }
    },
  };
}
