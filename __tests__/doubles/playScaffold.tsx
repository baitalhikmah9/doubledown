/**
 * Lightweight PlayScaffold double: keeps header chrome (customHeader / back) so
 * screen tests can find back controls and match menus without full layout.
 */
import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

type PlayScaffoldProps = {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
  customHeader?: React.ReactNode;
  onBack?: () => void;
  backVariant?: string;
  headerLeading?: React.ReactNode;
  footer?: React.ReactNode;
  footerAboveBody?: boolean;
  testID?: string;
  backgroundColor?: string;
  chromeColumnStyle?: StyleProp<ViewStyle>;
  contentMaxWidth?: number;
  bodyScrollEnabled?: boolean;
  bodyFrame?: boolean;
  bodyEdgeToEdge?: boolean;
  contentSafeAreaHorizontal?: boolean;
  footerBare?: boolean;
  showHud?: boolean;
};

export function PlayScaffold({
  children,
  title,
  customHeader,
  onBack,
  headerLeading,
  footer,
  footerAboveBody,
  testID,
  chromeColumnStyle,
}: PlayScaffoldProps) {
  const header =
    customHeader ??
    (onBack || title || headerLeading
      ? React.createElement(
          View,
          { testID: 'play-scaffold-header' },
          onBack
            ? React.createElement(
                Pressable,
                {
                  accessibilityRole: 'button',
                  accessibilityLabel: 'Back',
                  onPress: onBack,
                  style: { width: 44, height: 44, borderRadius: 14 },
                },
                React.createElement(Text, null, '←')
              )
            : null,
          headerLeading,
          title
            ? React.createElement(Text, { accessibilityRole: 'header' }, title)
            : null
        )
      : null);

  return React.createElement(
    View,
    { testID: testID ?? 'play-scaffold', style: chromeColumnStyle },
    header,
    footerAboveBody ? footer : null,
    children,
    footerAboveBody ? null : footer
  );
}

export default PlayScaffold;
