import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  getResolvedContentLocaleChain,
  normalizeContentLocales,
} from '@/lib/i18n/config';
import { setItemAsync } from 'expo-secure-store';
import { __resetSecureStoreDouble } from '../doubles/expoSecureStore';
import { useLocaleStore } from '@/store/locale';


beforeEach(() => {
  __resetSecureStoreDouble();
  useLocaleStore.setState({
    uiLocale: 'en',
    contentLocales: {
      primary: null,
      secondary: null,
      tertiary: null,
    },
    hasExplicitUiSelection: false,
    hasExplicitContentSelection: false,
  });
});

describe('locale helpers', () => {
  it('normalizes duplicate and overflow content locales', () => {
    expect(normalizeContentLocales(['ar', 'ar', 'fr', 'ur', 'es'])).toEqual({
      primary: 'ar',
      secondary: 'fr',
      tertiary: 'ur',
    });
  });

  it('builds a resolved content locale chain with implicit english', () => {
    expect(
      getResolvedContentLocaleChain({
        primary: 'ar',
        secondary: 'fr',
        tertiary: null,
      })
    ).toEqual(['ar', 'fr', 'en']);
  });
});

describe('useLocaleStore', () => {
  it('caps selected content locales at three and persists them', () => {
    useLocaleStore
      .getState()
      .setContentLocales(['ar', 'fr', 'ur', 'es']);

    expect(useLocaleStore.getState().contentLocales).toEqual({
      primary: 'ar',
      secondary: 'fr',
      tertiary: 'ur',
    });
    expect(setItemAsync).toHaveBeenCalled();
  });

  it('reorders selected content locales by priority', () => {
    useLocaleStore.getState().setContentLocales(['ar', 'fr', 'ur']);
    useLocaleStore.getState().moveContentLocale(2, 0);

    expect(useLocaleStore.getState().contentLocales).toEqual({
      primary: 'ur',
      secondary: 'ar',
      tertiary: 'fr',
    });
  });
});
