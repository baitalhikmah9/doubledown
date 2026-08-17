import {
  canonicalUrlForPath,
  DEFAULT_PAGE_TITLE,
  DEFAULT_PUBLIC_SITE_ORIGIN,
  getPublicSiteOrigin,
  pageTitleForPath,
} from '@/constants/site';

describe('site SEO helpers', () => {
  const prev = process.env.EXPO_PUBLIC_SITE_ORIGIN;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.EXPO_PUBLIC_SITE_ORIGIN;
    } else {
      process.env.EXPO_PUBLIC_SITE_ORIGIN = prev;
    }
  });

  it('defaults origin to playbackfire.com', () => {
    delete process.env.EXPO_PUBLIC_SITE_ORIGIN;
    expect(getPublicSiteOrigin()).toBe(DEFAULT_PUBLIC_SITE_ORIGIN);
    expect(DEFAULT_PUBLIC_SITE_ORIGIN).toBe('https://playbackfire.com');
  });

  it('trims EXPO_PUBLIC_SITE_ORIGIN and strips trailing slash', () => {
    process.env.EXPO_PUBLIC_SITE_ORIGIN = ' https://preview.example.com/ ';
    expect(getPublicSiteOrigin()).toBe('https://preview.example.com');
  });

  it('builds canonical URLs for paths', () => {
    delete process.env.EXPO_PUBLIC_SITE_ORIGIN;
    expect(canonicalUrlForPath('/')).toBe('https://playbackfire.com/');
    expect(canonicalUrlForPath('/play/mode')).toBe('https://playbackfire.com/play/mode');
  });

  it('builds distinct browser titles for known and detail pages', () => {
    expect(pageTitleForPath('/')).toBe(DEFAULT_PAGE_TITLE);
    expect(pageTitleForPath('/settings')).toBe('Settings | Backfire');
    expect(pageTitleForPath('/play/team-setup/')).toBe('Team Setup | Backfire');
    expect(pageTitleForPath('/admin/purchases/purchase_123')).toBe(
      'Purchase Details | Backfire'
    );
    expect(pageTitleForPath('/unknown')).toBe(DEFAULT_PAGE_TITLE);
  });
});
