/**
 * Guards the store redeem field against a hard-coded light fill that breaks dark mode.
 * Source-level check keeps the regression small without mounting Clerk/Convex.
 */
import fs from 'node:fs';
import path from 'node:path';

const storePath = path.join(__dirname, '../../app/(app)/store.tsx');

describe('store redeem input', () => {
  const source = fs.readFileSync(storePath, 'utf8');

  it('web redeems, native apps CTA to playbackfire.com', () => {
    expect(source).toContain("const IS_WEB_PLATFORM = Platform.OS === 'web'");
    expect(source).toContain("const IS_NATIVE_PLATFORM = IS_IOS_PLATFORM || IS_ANDROID_PLATFORM");
    expect(source).toContain("const PLAYBACKFIRE_SITE_URL = 'https://playbackfire.com'");
    // Web-only redeem UI.
    expect(source).toMatch(/IS_WEB_PLATFORM \? \(/);
    expect(source).toMatch(/testID="store-redeem-section"/);
    expect(source).toMatch(/IS_WEB_PLATFORM \?[\s\S]*redeemInput[\s\S]*\) : null/);
    // iOS and Android both deep-link to the website coupon box.
    expect(source).toMatch(/IS_NATIVE_PLATFORM \? \(/);
    expect(source).toMatch(/testID="store-native-promo-cta"/);
    expect(source).toMatch(/Linking\.openURL\(PLAYBACKFIRE_SITE_URL\)/);
    expect(source).toMatch(/To input promo\/coupon codes, head over to playbackfire\.com\./);
    expect(source).not.toMatch(/IS_IOS_PLATFORM && styles\.storeBodyWithoutRedeem/);
  });

  it('does not hard-code pure white on redeemInput styles', () => {
    // The StyleSheet redeemInput block must not pin backgroundColor: '#FFFFFF'.
    const redeemInputBlock = source.match(
      /redeemInput:\s*\{[\s\S]*?\},[\s\n]*redeemInputCompact/
    )?.[0];
    expect(redeemInputBlock).toBeTruthy();
    expect(redeemInputBlock).not.toMatch(/backgroundColor:\s*['"]#FFFFFF['"]/i);
    expect(redeemInputBlock).not.toMatch(/backgroundColor:\s*['"]#FFF['"]/i);
  });

  it('applies a theme-aware background on the redeem TextInput', () => {
    // Runtime style object on TextInput should set backgroundColor from a themed token.
    expect(source).toMatch(
      /backgroundColor:\s*redeemFieldBackground|redeemFieldBackground[\s\S]{0,200}backgroundColor/
    );
    expect(source).toMatch(/redeemFieldBackground\s*=/);
  });

  it('uses a single tokens-added success sentence without a second "tokens added" clause', () => {
    expect(source).toMatch(
      /\$\{formatTokens\((?:tokens|granted)\)\} tokens added to your balance\./
    );
    expect(source).not.toMatch(/tokens have been added to your balance/);
    expect(source).not.toMatch(/tokens added\.\`/);
  });
});
