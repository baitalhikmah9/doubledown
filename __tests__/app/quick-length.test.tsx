import React from 'react';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import QuickLengthScreen from '@/app/(app)/play/quick-length';
import { usePlayStore } from '@/store/play';
import { useThemeStore } from '@/store/theme';
import { router } from '../doubles/expoRouter';

describe('QuickLengthScreen', () => {
  beforeEach(() => {
    usePlayStore.setState({ session: null, tokens: 20, rapidFire: null });
    usePlayStore.getState().setMode('quickPlay');
    useThemeStore.setState({ paletteId: 'default' });
  });

  it('shows quick play topic choices 1–5 left to right with their token costs', () => {
    render(<QuickLengthScreen />);

    expect(screen.getByText('1 Topic')).toBeTruthy();
    expect(screen.getByTestId('quick-length-token-cost-1')).toHaveTextContent('2 TOKENS');
    expect(screen.getByText('2 Topics')).toBeTruthy();
    expect(screen.getByTestId('quick-length-token-cost-2')).toHaveTextContent('4 TOKENS');
    expect(screen.getByText('3 Topics')).toBeTruthy();
    expect(screen.getByTestId('quick-length-token-cost-3')).toHaveTextContent('5 TOKENS');
    expect(screen.getByText('4 Topics')).toBeTruthy();
    expect(screen.getByTestId('quick-length-token-cost-4')).toHaveTextContent('7 TOKENS');
    expect(screen.getByText('5 Topics')).toBeTruthy();
    expect(screen.getByTestId('quick-length-token-cost-5')).toHaveTextContent('8 TOKENS');
  });

  it('removes the white raised-surface strip from dark-mode choices', () => {
    useThemeStore.setState({ paletteId: 'dark' });
    render(<QuickLengthScreen />);

    const option = screen.getByLabelText('3 Topics, 5 tokens');
    const styleProp = option.props.style;
    const resolved =
      (styleProp instanceof Function) ? styleProp({ pressed: false }) : styleProp;
    const flat = StyleSheet.flatten(resolved);

    expect(flat.borderTopWidth).toBe(0);
    expect(flat.borderTopColor).toBe('transparent');
  });

  it('uses dark surface fill on length option cards in dark mode', () => {
    useThemeStore.setState({ paletteId: 'dark' });
    render(<QuickLengthScreen />);

    const option = screen.getByLabelText('3 Topics, 5 tokens');
    const styleProp = option.props.style;
    const resolved =
      (styleProp instanceof Function) ? styleProp({ pressed: false }) : styleProp;
    const flat = StyleSheet.flatten(resolved);

    expect(flat.backgroundColor).toBe('#111E2E');
    expect(flat.backgroundColor).not.toBe('#FFFFFF');
    expect(flat.backgroundColor).not.toBe('#FDFCFA');
  });

  it('continues quick play with the selected topic count', () => {
    render(<QuickLengthScreen />);

    fireEvent.press(screen.getByLabelText('4 Topics, 7 tokens'));

    expect(usePlayStore.getState().session?.mode).toBe('quickPlay');
    expect(usePlayStore.getState().session?.step).toBe('team-setup');
    expect(usePlayStore.getState().session?.config.quickPlayTopicCount).toBe(4);
    expect(router.push).toHaveBeenCalledWith('/play/team-setup');
  });

  it('redirects back into the active match instead of allowing topic switches mid-game', () => {
    const current = usePlayStore.getState().session;
    usePlayStore.setState({
      session: current
        ? {
            ...current,
            mode: 'quickPlay',
            step: 'board',
            phase: 'wagerDecision',
            config: {
              ...current.config,
              mode: 'quickPlay',
              quickPlayTopicCount: 3,
            },
          }
        : null,
    });

    render(<QuickLengthScreen />);

    expect(router.replace).toHaveBeenCalledWith('/play/board');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('uses settings-style icon-only back control (not labeled play pill)', () => {
    render(<QuickLengthScreen />);

    const back = screen.getByLabelText('Back');
    // Match team-setup / settings / store: icon squircle, no visible "Back" label.
    expect(screen.queryByText('Back')).toBeNull();

    const styleProp = back.props.style;
    const resolved =
      (styleProp instanceof Function) ? styleProp({ pressed: false }) : styleProp;
    const flat = StyleSheet.flatten(resolved);

    expect(flat.width).toBe(44);
    expect(flat.height).toBe(44);
    expect(flat.borderRadius).toBe(14);
  });
});
