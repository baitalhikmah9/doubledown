/**
 * Admin theme tokens. Neutral content surfaces with Backfire's warm cream shell.
 */

export const ADMIN_THEME = {
  colors: {
    // Canvas & Card
    background: '#FFFFFF',
    foreground: '#09090B',
    card: '#FFFFFF',
    cardForeground: '#09090B',
    popover: '#FFFFFF',
    popoverForeground: '#09090B',

    // Primary & Secondary
    primary: '#18181B',
    primaryForeground: '#FAFAFA',
    secondary: '#F4F4F5',
    secondaryForeground: '#18181B',

    // Muted & Accent
    muted: '#F4F4F5',
    mutedForeground: '#71717A',
    accent: '#F4F4F5',
    accentForeground: '#18181B',

    // Destructive
    destructive: '#DC2626',
    destructiveForeground: '#FAFAFA',

    // Borders & Inputs
    border: '#E4E4E7',
    input: '#E4E4E7',
    inputBackground: '#FFFFFF',
    ring: '#18181B',

    // Sidebar. Matches the warm cream canvas used across Backfire's main pages.
    sidebar: '#F0EBE3',
    sidebarForeground: '#333333',
    sidebarMuted: '#706A62',
    sidebarBorder: '#D8D0C5',
    sidebarAccent: '#FFFFFF',
    sidebarAccentForeground: '#333333',

    // Table
    tableHeader: '#FAFAFA',
    tableBorder: '#E4E4E7',
    tableRowDivider: '#E4E4E7',
    tableRowHover: '#F4F4F5',

    // Status colors
    status: {
      success: '#16A34A',
      successBg: '#F0FDF4',
      successBorder: '#BBF7D0',
      error: '#DC2626',
      errorBg: '#FEF2F2',
      errorBorder: '#FECACA',
      info: '#2563EB',
      infoBg: '#EFF6FF',
      infoBorder: '#BFDBFE',
      warning: '#D97706',
      warningBg: '#FFFBEB',
      warningBorder: '#FDE68A',
      neutral: '#71717A',
      neutralBg: '#F4F4F5',
      neutralBorder: '#E4E4E7',
    },
  },
  radius: {
    sm: 4,
    md: 6,
    lg: 8,
    xl: 12,
  },
} as const;
