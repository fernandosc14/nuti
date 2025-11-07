import React from 'react';
// initialize nativewind/runtime interop early (use the package's dist runtime entry that Metro can resolve)
import 'react-native-css-interop/dist/runtime/index.native';
import { Slot } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View } from 'react-native';
import BottomNav from '../components/BottomNav';

const queryClient = new QueryClient();

export default function Layout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SafeAreaView className="flex-1 bg-gray-50">
          <View className="flex-1">
            <Slot />
            <BottomNav />
          </View>
        </SafeAreaView>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
