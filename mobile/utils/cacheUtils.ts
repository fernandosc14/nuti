/**
 * Cache Utilities
 *
 * Functions to manage local cache using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@nuti_cache_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Stores data in cache with timestamp
 */
export async function setCache<T>(key: string, data: T, ttl: number = CACHE_TTL): Promise<void> {
  try {
    const cacheData: CachedData<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error setting cache:', error);
  }
}

/**
 * Gets data from cache if still valid
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!cached) {
      return null;
    }

    const cacheData: CachedData<T> = JSON.parse(cached);
    const now = Date.now();
    const age = now - cacheData.timestamp;

    // Check if the cache is still valid
    if (age < cacheData.ttl) {
      return cacheData.data;
    }

    // Cache expired, remove
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
    return null;
  } catch (error) {
    console.error('Error getting cache:', error);
    return null;
  }
}

/**
 * Removes data from cache
 */
export async function removeCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch (error) {
    console.error('Error removing cache:', error);
  }
}

/**
 * Clears all cache
 */
export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

/**
 * Invalidates cache related to a user
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => 
      key.startsWith(CACHE_PREFIX) && key.includes(userId)
    );
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.error('Error invalidating user cache:', error);
  }
}

/**
 * Clears only the food search cache
 */
export async function clearFoodSearchCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => 
      key.startsWith(CACHE_PREFIX) && key.includes('food_search_')
    );
    await AsyncStorage.multiRemove(cacheKeys);
    console.log(`Cleared ${cacheKeys.length} food search cache entries`);
  } catch (error) {
    console.error('Error clearing food search cache:', error);
  }
}

