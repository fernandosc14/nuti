import React from 'react';
import { Image, View, Text, ImageProps } from 'react-native';

type Props = ImageProps & {
  size?: number;
  fallback?: string;
};

export default function Avatar({ size = 48, source, fallback, style, ...rest }: Props) {
  return (
    <View style={{ width: size, height: size }} className="rounded-full overflow-hidden bg-gray-200 items-center justify-center">
      {source ? (
        // @ts-ignore - source typing
        <Image source={source as any} style={{ width: size, height: size }} {...rest} />
      ) : (
        <Text className="text-gray-600">{fallback ?? ''}</Text>
      )}
    </View>
  );
}
