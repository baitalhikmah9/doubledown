/** Controllable play surface colors double. */

let colors = {
  isDark: false,
  canvas: '#F5F0E8',
  surface: '#FFFFFF',
  topicImageMatte: '#E8E0D4',
  missingPictureLabelColor: '#333333',
  topicLabelBackground: '#FFFFFF',
  topicLabelText: '#111111',
  controlBackground: '#FFFFFF',
  hoverSurface: '#FDFCFA',
  hairlineBorder: 'rgba(15, 23, 42, 0.12)',
  iconChipBackground: 'rgba(255, 255, 255, 0.95)',
  dangerSoftBackground: '#FEE2E2',
  bootScrim: 'rgba(240, 235, 227, 0.92)',
  activeTurnFace: '#FFF3EC',
  activeTurnNestedFill: '#FFF3EC',
  activeTurnOnFace: '#E8420C',
  text: '#111111',
  mutedText: '#666666',
};

export function getPlaySurfaceColors() {
  return colors;
}

export function __setPlaySurfaceColors(next: Partial<typeof colors>): void {
  colors = { ...colors, ...next };
}

export function __resetPlaySurfaceColorsDouble(): void {
  colors = {
    isDark: false,
    canvas: '#F5F0E8',
    surface: '#FFFFFF',
    topicImageMatte: '#E8E0D4',
    missingPictureLabelColor: '#333333',
    topicLabelBackground: '#FFFFFF',
    topicLabelText: '#111111',
    controlBackground: '#FFFFFF',
    hoverSurface: '#FDFCFA',
    hairlineBorder: 'rgba(15, 23, 42, 0.12)',
    iconChipBackground: 'rgba(255, 255, 255, 0.95)',
    dangerSoftBackground: '#FEE2E2',
    bootScrim: 'rgba(240, 235, 227, 0.92)',
    activeTurnFace: '#FFF3EC',
    activeTurnNestedFill: '#FFF3EC',
    activeTurnOnFace: '#E8420C',
    text: '#111111',
    mutedText: '#666666',
  };
}
