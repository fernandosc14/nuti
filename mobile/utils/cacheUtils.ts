/**
 * Cache Utilities
 * 
 * Funções para gerenciar cache local usando AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@nuti_cache_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos em milissegundos

interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Guarda dados no cache com timestamp
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
 * Obtém dados do cache se ainda válidos
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

    // Verificar se o cache ainda é válido
    if (age < cacheData.ttl) {
      return cacheData.data;
    }

    // Cache expirado, remover
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
    return null;
  } catch (error) {
    console.error('Error getting cache:', error);
    return null;
  }
}

/**
 * Remove dados do cache
 */
export async function removeCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch (error) {
    console.error('Error removing cache:', error);
  }
}

/**
 * Limpa todo o cache
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
 * Invalida cache relacionado a um utilizador
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

