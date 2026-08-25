import React from 'react';
import { View, Text } from 'react-native';

export function PublicAuthEntry() {
  return React.createElement(
    View,
    { testID: 'public-auth-entry' },
    React.createElement(Text, null, 'PublicAuthEntry')
  );
}

export default PublicAuthEntry;
