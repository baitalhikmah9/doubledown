/** In-memory AsyncStorage double. */

const memory = new Map<string, string>();

async function getItemImpl(key: string): Promise<string | null> {
  return memory.has(key) ? (memory.get(key) ?? null) : null;
}

async function setItemImpl(key: string, value: string): Promise<void> {
  memory.set(key, value);
}

async function removeItemImpl(key: string): Promise<void> {
  memory.delete(key);
}

async function multiGetImpl(keys: string[]): Promise<[string, string | null][]> {
  return Promise.all(keys.map(async (key) => [key, await getItemImpl(key)]));
}

async function multiSetImpl(entries: [string, string][]): Promise<void> {
  for (const [key, value] of entries) {
    await setItemImpl(key, value);
  }
}

async function multiRemoveImpl(keys: string[]): Promise<void> {
  for (const key of keys) {
    await removeItemImpl(key);
  }
}

async function clearImpl(): Promise<void> {
  memory.clear();
}

async function getAllKeysImpl(): Promise<string[]> {
  return [...memory.keys()];
}

export const getItem = jest.fn(getItemImpl);
export const setItem = jest.fn(setItemImpl);
export const removeItem = jest.fn(removeItemImpl);
export const multiGet = jest.fn(multiGetImpl);
export const multiSet = jest.fn(multiSetImpl);
export const multiRemove = jest.fn(multiRemoveImpl);
export const clear = jest.fn(clearImpl);
export const getAllKeys = jest.fn(getAllKeysImpl);

const api = {
  getItem,
  setItem,
  removeItem,
  multiGet,
  multiSet,
  multiRemove,
  clear,
  getAllKeys,
};

export default api;

export function __resetAsyncStorageDouble(): void {
  memory.clear();
  getItem.mockClear();
  setItem.mockClear();
  removeItem.mockClear();
  multiGet.mockClear();
  multiSet.mockClear();
  multiRemove.mockClear();
  clear.mockClear();
  getAllKeys.mockClear();
}

export function __asyncStorageMemory(): Map<string, string> {
  return memory;
}
