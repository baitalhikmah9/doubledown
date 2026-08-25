import { StyleSheet } from 'react-native';
import { FONTS } from '@/constants/theme';
import {
  ARABIC_FONTS,
  containsArabicScript,
  contentUsesArabicScriptFont,
  getArabicFontFamily,
  installLocaleFontRemap,
  remapFontFamilyForLocale,
  resolveContentFontFamily,
  resolveLocaleFontFamily,
  setActiveUiFontLocale,
  uninstallLocaleFontRemapForTests,
  usesArabicScriptFont,
} from '@/lib/i18n/fonts';

describe('lib/i18n/fonts', () => {
  afterEach(() => {
    setActiveUiFontLocale('en');
    uninstallLocaleFontRemapForTests();
  });

  it('detects Arabic letters in question copy', () => {
    expect(containsArabicScript('ما هو عاصمة فرنسا؟')).toBe(true);
    expect(containsArabicScript('What is the capital of France?')).toBe(false);
    expect(contentUsesArabicScriptFont('en', 'مرحبا')).toBe(true);
    expect(contentUsesArabicScriptFont('en', 'Hello')).toBe(false);
  });

  it('resolves Noto for English locale when copy contains Arabic script', () => {
    expect(
      resolveContentFontFamily('en', 'سؤال بالعربية', 'display', 'ios')
    ).toBe(ARABIC_FONTS.display);
    expect(resolveContentFontFamily('en', 'Latin only', 'display', 'ios')).toBe(
      FONTS.display
    );
  });

  // SAFETY: Test fixture / double boundary cast justified by controlled test setup.
  it('treats ar and ur as Arabic-script font locales', () => {
    expect(usesArabicScriptFont('ar')).toBe(true);
    expect(usesArabicScriptFont('ur')).toBe(true);
    expect(usesArabicScriptFont('en')).toBe(false);
    expect(usesArabicScriptFont('hi')).toBe(false);
  });

  it('maps brand faces to Noto for Arabic locales', () => {
    expect(remapFontFamilyForLocale('GeneralSans-Regular', 'ar')).toBe(
      ARABIC_FONTS.ui
    );
    expect(remapFontFamilyForLocale('ClashDisplay-Bold', 'ur')).toBe(
      ARABIC_FONTS.displayBold
    );
    expect(remapFontFamilyForLocale('GeneralSans-Regular', 'en')).toBe(
      'GeneralSans-Regular'
    );
    // Web CSS stacks: remap using the primary face name
    expect(
      remapFontFamilyForLocale(
        'GeneralSans-Regular, NotoSansArabic_400Regular, sans-serif',
        'ar'
      )
    ).toBe(ARABIC_FONTS.ui);
  });

  it('does not remap icon or unknown font families', () => {
    expect(remapFontFamilyForLocale('ionicons', 'ar')).toBe('ionicons');
    expect(remapFontFamilyForLocale(undefined, 'ar')).toBeUndefined();
  });

  it('resolves Arabic roles to concrete Noto faces on every platform', () => {
    for (const os of ['ios', 'android', 'web']) {
      expect(resolveLocaleFontFamily('ar', 'body', os)).toBe(ARABIC_FONTS.ui);
      expect(resolveLocaleFontFamily('ar', 'displayBold', os)).toBe(
        ARABIC_FONTS.displayBold
      );
      expect(resolveLocaleFontFamily('ur', 'bodySemibold', os)).toBe(
        ARABIC_FONTS.uiSemibold
      );
    }
  });

  it('keeps brand faces for Latin locales', () => {
    expect(resolveLocaleFontFamily('en', 'body', 'ios')).toBe(FONTS.ui);
    expect(resolveLocaleFontFamily('es', 'displayBold', 'android')).toBe(
      FONTS.displayBold
    );
  });

  it('uses platform system faces for non-Arabic system-font locales', () => {
    expect(resolveLocaleFontFamily('hi', 'body', 'android')).toBe('sans-serif');
    expect(resolveLocaleFontFamily('zh-Hans', 'bodyBold', 'android')).toBe(
      'sans-serif-medium'
    );
    expect(resolveLocaleFontFamily('bn', 'body', 'ios')).toBeUndefined();
    expect(resolveLocaleFontFamily('hi', 'body', 'web')).toContain('system-ui');
  });

  it('patches StyleSheet.flatten to rewrite brand fonts while UI is Arabic', () => {
    installLocaleFontRemap();
    setActiveUiFontLocale('ar');

    // SAFETY: StyleSheet.flatten return is a plain style bag in this test path.
    const flat = StyleSheet.flatten({
      fontFamily: 'GeneralSans-Bold',
      fontSize: 16,
    }) as { fontFamily: string; fontSize: number };

    expect(flat.fontFamily).toBe(ARABIC_FONTS.uiBold);
    expect(flat.fontSize).toBe(16);
  });

  it('does not rewrite brand fonts when UI locale is English', () => {
    installLocaleFontRemap();
    setActiveUiFontLocale('en');

    // SAFETY: StyleSheet.flatten return is a plain style bag in this test path.
    const flat = StyleSheet.flatten({
      fontFamily: 'GeneralSans-Regular',
    }) as { fontFamily: string };

    expect(flat.fontFamily).toBe('GeneralSans-Regular');
  });

  it('exposes role helpers used by getLocaleFontFamily', () => {
    expect(getArabicFontFamily('bodyMedium')).toBe(ARABIC_FONTS.uiMedium);
    expect(getArabicFontFamily('display')).toBe(ARABIC_FONTS.display);
  });
});
