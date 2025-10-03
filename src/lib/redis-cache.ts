import { Redis } from '@upstash/redis';

// Redis 클라이언트 초기화
let redis: Redis | null = null;

try {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    throw new Error('Upstash Redis URL/Token is not configured in environment variables.');
  }

  redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });
} catch (error) {
  console.error("Failed to initialize Redis client:", error);
}

// 캐시 키 생성 함수
export const getCacheKey = (
  materials: string[],
  startDate: string,
  endDate: string,
  interval: string
) => {
  const sortedMaterials = [...materials].sort().join(',');
  return `material_prices:${sortedMaterials}:${startDate}:${endDate}:${interval}`;
};

// Redis에서 데이터 가져오는 함수
export const getMaterialDataFromCache = async (
  materials: string[],
  startDate: string,
  endDate: string,
  interval: string
) => {
  if (!redis) return null; // Redis 클라이언트가 없으면 캐시 조회 건너뛰기
  const cacheKey = getCacheKey(materials, startDate, endDate, interval);
  try {
    const data = await redis.get(cacheKey);
    return data ? JSON.parse(data as string) : null;
  } catch (error) {
    console.error('Error getting data from Redis cache:', error);
    return null;
  }
};

// Redis에 데이터 저장하는 함수
export const setMaterialDataToCache = async (
  materials: string[],
  startDate: string,
  endDate: string,
  interval: string,
  data: any
) => {
  if (!redis) return; // Redis 클라이언트가 없으면 캐시 저장 건너뛰기
  const cacheKey = getCacheKey(materials, startDate, endDate, interval);
  try {
    // 캐시 유효기간: 1시간 (3600초)
    // 캐시 유효기간: 1시간 (3600초)
    await redis.set(cacheKey, JSON.stringify(data), { ex: 3600 });
  } catch (error) {
    console.error('Error setting data to Redis cache:', error);
  }
};