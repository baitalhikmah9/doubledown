/** Minimal `expo-image` double. */
import React from 'react';
import { View, type ViewProps } from 'react-native';

type ImageProps = ViewProps & {
  source?: unknown;
  contentFit?: string;
  accessibilityLabel?: string;
  testID?: string;
  accessibilityRole?: string;
};

function Image(props: ImageProps) {
  return React.createElement(View, {
    accessibilityLabel: props.accessibilityLabel,
    accessibilityRole: props.accessibilityRole,
    testID: props.testID,
    style: props.style,
  });
}

Image.loadAsync = jest.fn(async () => ({}));
Image.prefetch = jest.fn(async () => true);

export { Image };
export default { Image };
