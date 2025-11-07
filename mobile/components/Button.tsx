import React from 'react';
import { Pressable, Text, PressableProps } from 'react-native';

type Props = PressableProps & {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
};

export default function Button({ children, variant = 'primary', style, ...rest }: Props) {
  const base = 'px-4 py-2 rounded-md items-center justify-center';
  const variants: Record<string, string> = {
    primary: 'bg-blue-600',
    secondary: 'bg-gray-200',
    ghost: 'bg-transparent',
  };

  return (
    <Pressable className={`${base} ${variants[variant]}`} style={style} {...rest}>
      <Text className={variant === 'secondary' ? 'text-black' : 'text-white'}>{children}</Text>
    </Pressable>
  );
}
