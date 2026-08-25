import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  getMatchMenuViewportScale,
  PlayMatchMenuModal,
} from '@/features/play/components/PlayMatchMenuModal';

describe('PlayMatchMenuModal', () => {
  it('scales proportionally with web viewport area', () => {
    expect(getMatchMenuViewportScale(1200, 675)).toBe(1);
    expect(getMatchMenuViewportScale(1800, 1012.5)).toBe(1.5);
  });

  it('dims the full host viewport behind Settings and Exit Game', () => {
    const onClose = jest.fn();
    render(
      <PlayMatchMenuModal
        visible
        onClose={onClose}
        onSettings={jest.fn()}
        onExitGame={jest.fn()}
      />
    );

    const overlay = screen.getByTestId('play-match-menu-modal');
    const overlayStyle = StyleSheet.flatten(overlay.props.style);

    // Prefer flex + 100% over absoluteFill alone: Modal hosts often lack a sized
    // parent, so edge-only absolute positioning can leave undimmed screen regions.
    expect(overlayStyle.flex).toBe(1);
    expect(overlayStyle.width).toBe('100%');
    expect(overlayStyle.height).toBe('100%');
    expect(overlayStyle.backgroundColor).toBeTruthy();
    expect(screen.getByLabelText('Settings')).toBeTruthy();
    expect(screen.getByLabelText('Exit Game')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
