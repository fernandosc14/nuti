import React from 'react';
import { View, ViewProps } from 'react-native';

export default function Card({ children, style, ...rest }: ViewProps) {
  return (
    <View className="bg-white rounded-lg p-4 shadow-md" style={style} {...rest}>
      {children}
    </View>
  );
}
