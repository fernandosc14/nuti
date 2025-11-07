import React from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';

type Props = TextInputProps & {
  label?: string;
};

export default function Input({ label, style, ...rest }: Props) {
  return (
    <View className="w-full mb-3">
      {label ? <Text className="mb-1 text-sm text-gray-700">{label}</Text> : null}
      <TextInput className="border border-gray-300 px-3 py-2 rounded-md bg-white" style={style} {...rest} />
    </View>
  );
}
