import React from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Modal, Platform, StyleSheet } from 'react-native';

import TeamSetupScreen from '@/app/(app)/play/team-setup';
import { COLORS } from '@/constants';
import { usePlayStore } from '@/store/play';
import { useThemeStore } from '@/store/theme';
import { HOME_SOFT_UI } from '@/themes';
import { router } from '../doubles/expoRouter';
import { __setWindowDimensions } from '../doubles/windowDimensions';

describe('TeamSetupScreen', () => {
  beforeEach(async () => {
    __setWindowDimensions({
      width: 390,
      height: 844,
      scale: 2,
      fontScale: 1,
    });
    usePlayStore.setState({ session: null, tokens: 5, rapidFire: null });
    useThemeStore.setState({ paletteId: 'default' });
    await usePlayStore.getState().hydrate();
    usePlayStore.getState().ensureDraft();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens wager setup help in a full-screen overlay', () => {
    render(<TeamSetupScreen />);

    expect(screen.UNSAFE_queryByType(Modal)).toBeNull();

    fireEvent.press(screen.getByText('What is Wager?'));

    if (Platform.OS !== 'web') {
      expect(screen.UNSAFE_queryByType(Modal)).not.toBeNull();
    } else {
      expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
    }
    const overlay = screen.getByTestId('wager-info-overlay');
    expect(overlay).toBeTruthy();
    expect(screen.getByText('Wagers are a risky way to try and sabotage the other team!')).toBeTruthy();

    const overlayStyle = StyleSheet.flatten(overlay.props.style);
    // Full-viewport scrim (not flex-only) so web fixed shells and native Modal both dim the screen.
    expect(overlayStyle.top).toBe(0);
    expect(overlayStyle.right).toBe(0);
    expect(overlayStyle.bottom).toBe(0);
    expect(overlayStyle.left).toBe(0);
    expect(overlayStyle.backgroundColor).toBe(COLORS.overlay);

    fireEvent.press(screen.getByLabelText('Close'));
  });

  it('shows the rumble team-count selector but hides wager and hot seat controls', () => {
    usePlayStore.getState().setMode('rumble');

    render(<TeamSetupScreen />);

    expect(screen.getByText('NUMBER OF TEAMS')).toBeTruthy();
    for (const option of ['2', '3', '4', '6']) {
      expect(screen.getByText(option)).toBeTruthy();
    }
    expect(screen.getByLabelText('2 teams').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.queryByText('Hot Seat')).toBeNull();
    expect(screen.queryByText('Wager')).toBeNull();

    fireEvent.press(screen.getByLabelText('6 teams'));

    expect(usePlayStore.getState().session?.teams).toHaveLength(6);
    expect(screen.getByLabelText('6 teams').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('2 teams').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('shows Continue for rumble setup on wide web (floating CTA is not classic-only)', () => {
    // Classic wide-web embeds Continue in the 3-column row; rumble must still show a CTA.
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    __setWindowDimensions({
      width: 1280,
      height: 800,
      scale: 1,
      fontScale: 1,
    });
    try {
      usePlayStore.getState().setMode('rumble');

      render(<TeamSetupScreen />);

      expect(screen.getByText('NUMBER OF TEAMS')).toBeTruthy();
      expect(screen.getByText('CONTINUE')).toBeTruthy();
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    }
  });

  it('updates team card color when the theme changes', () => {
    useThemeStore.setState({ paletteId: 'dark' });
    const { rerender } = render(<TeamSetupScreen />);

    expect(StyleSheet.flatten(screen.getAllByTestId('team-setup-team-card')[0].props.style).backgroundColor).toBe('#111E2E');

    act(() => {
      useThemeStore.setState({ paletteId: 'default' });
    });
    rerender(<TeamSetupScreen />);

    expect(StyleSheet.flatten(screen.getAllByTestId('team-setup-team-card')[0].props.style).backgroundColor).toBe('#FFFFFF');
  });

  it('uses distinct controls for adding and removing players', () => {
    render(<TeamSetupScreen />);

    const addControls = screen.getAllByLabelText('Add a team member');
    fireEvent.press(addControls[0]);

    const addControl = screen.getAllByLabelText('Add a team member')[0];
    const removeControl = screen.getByLabelText('Remove a team member');

    expect(addControl.props.style).not.toEqual(removeControl.props.style);
  });

  it('renders Add Player with light surface fill and dark text in light mode', () => {
    useThemeStore.setState({ paletteId: 'default' });
    render(<TeamSetupScreen />);

    const addControl = screen.getAllByLabelText('Add a team member')[0];
    const styleProp = addControl.props.style;
    const resolved =
      (styleProp instanceof Function) ? styleProp({ pressed: false }) : styleProp;
    const flat = StyleSheet.flatten(resolved);

    // Light mode: light surface control with dark label (adapts with theme).
    expect(flat.backgroundColor).toBe(HOME_SOFT_UI.colors.surface);
    expect(flat.backgroundColor).not.toBe(COLORS.text);

    const addLabel = screen.getAllByText('Add Player')[0];
    const labelFlat = StyleSheet.flatten(addLabel.props.style);
    expect(labelFlat.color).toBe(HOME_SOFT_UI.colors.textPrimary);
    expect(labelFlat.color).not.toBe('#FFFFFF');
  });

  it('renders Add Player with dark surface fill and light text in dark mode', () => {
    useThemeStore.setState({ paletteId: 'dark' });
    render(<TeamSetupScreen />);

    const addControl = screen.getAllByLabelText('Add a team member')[0];
    const styleProp = addControl.props.style;
    const resolved =
      (styleProp instanceof Function) ? styleProp({ pressed: false }) : styleProp;
    const flat = StyleSheet.flatten(resolved);

    // Dark mode: dark surface fill with light label (not always-navy).
    expect(flat.backgroundColor).toBe(HOME_SOFT_UI.colors.surface);
    expect(flat.backgroundColor).not.toBe(COLORS.text);
    expect(flat.backgroundColor).not.toBe('#FFFFFF');

    const addLabel = screen.getAllByText('Add Player')[0];
    const labelFlat = StyleSheet.flatten(addLabel.props.style);
    expect(labelFlat.color).toBe(HOME_SOFT_UI.colors.textPrimary);
    expect(labelFlat.color).not.toBe('#FFFFFF');
  });

  it('uses settings-style icon-only back control (not labeled play pill)', () => {
    render(<TeamSetupScreen />);

    const back = screen.getByLabelText('Back');
    // Labeled play pill shows visible "Back" text; settings/store are icon-only.
    expect(screen.queryByText('Back')).toBeNull();

    const styleProp = back.props.style;
    const resolved =
      (styleProp instanceof Function) ? styleProp({ pressed: false }) : styleProp;
    const flat = StyleSheet.flatten(resolved);

    expect(flat.width).toBe(44);
    expect(flat.height).toBe(44);
    expect(flat.borderRadius).toBe(14);
  });

  it('keeps a small dead zone under the phone continue strip above the bezel', () => {
    // SafeAreaView still clears the home indicator; strip adds modest pad so Continue
    // is not flush to the edge on zero-inset / landscape devices.
    __setWindowDimensions({
      width: 874,
      height: 402,
      scale: 3,
      fontScale: 1,
    });

    render(<TeamSetupScreen />);

    const strip = screen.getByTestId('team-setup-continue-strip');
    const flat = StyleSheet.flatten(strip.props.style);
    expect(flat.paddingBottom).toBeGreaterThanOrEqual(8);
    expect(flat.paddingBottom).toBeLessThanOrEqual(16);
  });

  it('returns to quick-play topic length when going back during quick play', () => {
    usePlayStore.getState().setMode('quickPlay');
    usePlayStore.getState().setQuickPlayTopicCount(4);

    render(<TeamSetupScreen />);
    fireEvent.press(screen.getByLabelText('Back'));

    expect(router.replace).toHaveBeenCalledWith('/play/quick-length');
    expect(router.replace).not.toHaveBeenCalledWith('/(app)/');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('returns home when going back during classic setup', () => {
    usePlayStore.getState().setMode('classic');

    render(<TeamSetupScreen />);
    fireEvent.press(screen.getByLabelText('Back'));

    expect(router.replace).toHaveBeenCalledWith('/(app)/');
    expect(router.replace).not.toHaveBeenCalledWith('/play/quick-length');
  });

  it('returns home when going back during rumble setup instead of topics', () => {
    usePlayStore.getState().setMode('rumble');

    render(<TeamSetupScreen />);
    fireEvent.press(screen.getByLabelText('Back'));

    expect(router.replace).toHaveBeenCalledWith('/(app)/');
    expect(router.replace).not.toHaveBeenCalledWith('/play/categories');
    expect(router.push).not.toHaveBeenCalledWith('/play/categories');
  });

  it('uses stack back to topic length when quick play has history', () => {
    router.canGoBack.mockReturnValue(true);
    usePlayStore.getState().setMode('quickPlay');
    usePlayStore.getState().setQuickPlayTopicCount(3);

    render(<TeamSetupScreen />);
    fireEvent.press(screen.getByLabelText('Back'));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
