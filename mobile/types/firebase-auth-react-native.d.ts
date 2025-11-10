declare module 'firebase/auth/react-native' {
  // Minimal typing for getReactNativePersistence to satisfy TypeScript in this project
  import type { Persistence } from 'firebase/auth';
  export function getReactNativePersistence(storage: any): Persistence;
}
