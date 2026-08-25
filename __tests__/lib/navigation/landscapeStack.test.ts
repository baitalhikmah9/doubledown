import { afterEach, describe, expect, it } from '@jest/globals';
import { PALETTES } from '@/constants/theme';
import { getLandscapeStackScreenOptions } from '@/lib/navigation/landscapeStack';
import { useThemeStore } from '@/store/theme';
import { HOME_SOFT_UI } from '@/themes';

describe('getLandscapeStackScreenOptions', () => {
  afterEach(() => {
    useThemeStore.setState({ paletteId: 'default' });
  });

  it('paints contentStyle with the soft-UI canvas (not pure white)', () => {
    const options = getLandscapeStackScreenOptions(HOME_SOFT_UI.colors.canvas);
    // SAFETY: Controlled test fixture boundary cast.
    const contentStyle = options.contentStyle as { backgroundColor?: string; flex?: number };

    expect(contentStyle.flex).toBe(1);
    expect(contentStyle.backgroundColor).toBe(HOME_SOFT_UI.colors.canvas);
    expect(contentStyle.backgroundColor).not.toBe('#FFFFFF');
    expect(contentStyle.backgroundColor).not.toBe('#FFF');
  });

  it('uses dark palette canvas under fade so board↔question turns do not flash white', () => {
    useThemeStore.setState({ paletteId: 'dark' });
    const darkCanvas = PALETTES.dark.background;
    const options = getLandscapeStackScreenOptions(HOME_SOFT_UI.colors.canvas);
    // SAFETY: Controlled test fixture boundary cast.
    const contentStyle = options.contentStyle as { backgroundColor?: string };

    expect(contentStyle.backgroundColor).toBe(darkCanvas);
    expect(contentStyle.backgroundColor).not.toBe('#FFFFFF');
    expect(contentStyle.backgroundColor).not.toBe('#F0EBE3');
    expect(options.animation).toBe('fade');
  });

  it('accepts an explicit canvas override', () => {
    const options = getLandscapeStackScreenOptions('#112233');
    // SAFETY: Controlled test fixture boundary cast.
    const contentStyle = options.contentStyle as { backgroundColor?: string };
    expect(contentStyle.backgroundColor).toBe('#112233');
  });
});
