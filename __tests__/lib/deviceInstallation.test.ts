import { describe, expect, it } from '@jest/globals';
import {
  getOrCreateInstallationIdWithStore,
  INSTALL_KEY,
} from '@/lib/deviceInstallationLogic';

function memoryStore() {
  const map = new Map<string, string>();
  return {
    map,
    store: {
      getItem: async (key: string) => map.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        map.set(key, value);
      },
      deleteItem: async (key: string) => {
        map.delete(key);
      },
    },
  };
}

describe('deviceInstallationLogic', () => {
  it('creates one install ID and reuses stored ID', async () => {
    const { store, map } = memoryStore();
    const a = await getOrCreateInstallationIdWithStore(store);
    const b = await getOrCreateInstallationIdWithStore(store);
    expect(a).toBe(b);
    expect(a.startsWith('inst_')).toBe(true);
    expect(map.get(INSTALL_KEY)).toBe(a);
  });

  it('recovers from corrupt storage', async () => {
    const { store, map } = memoryStore();
    map.set(INSTALL_KEY, '!!!');
    const id = await getOrCreateInstallationIdWithStore(store);
    expect(id.startsWith('inst_')).toBe(true);
    const again = await getOrCreateInstallationIdWithStore(store);
    expect(again).toBe(id);
  });
});
