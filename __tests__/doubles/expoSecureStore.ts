/** In-memory SecureStore double. */

const memory = new Map<string, string>();

export const getItemAsync = jest.fn(async (key: string): Promise<string | null> => {
  return memory.has(key) ? (memory.get(key) ?? null) : null;
});

export const setItemAsync = jest.fn(async (key: string, value: string): Promise<void> => {
  memory.set(key, value);
});

export const deleteItemAsync = jest.fn(async (key: string): Promise<void> => {
  memory.delete(key);
});

export const WHEN_UNLOCKED = 'WHEN_UNLOCKED';
export const AFTER_FIRST_UNLOCK = 'AFTER_FIRST_UNLOCK';

export function __resetSecureStoreDouble(): void {
  memory.clear();
  getItemAsync.mockClear();
  setItemAsync.mockClear();
  deleteItemAsync.mockClear();
}

export function __secureStoreMemory(): Map<string, string> {
  return memory;
}
