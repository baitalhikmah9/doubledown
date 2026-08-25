import React from 'react';
import { View } from 'react-native';

export function BackfireTitleLogo(props: {
  testID?: string;
  width?: number;
  accessibilityLabel?: string;
}) {
  return React.createElement(View, {
    testID: props.testID ?? 'backfire-title-logo',
    accessibilityRole: 'image',
    accessibilityLabel: props.accessibilityLabel ?? 'BackFire',
  });
}

export default BackfireTitleLogo;
