'use server';

import { Redis } from "@upstash/redis";

export async function clearRedisCache() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error("❌ Redis 환경 변수가 누락되었습니다.");
    return { success: false, message: "Redis 환경 변수가 설정되지 않았습니다." };
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  try {
    const keys = await redis.keys('material_prices:*');
    if (keys.length > 0) {
      await Promise.all(keys.map(key => redis.del(key)));
      console.log(`✅ Redis 캐시 삭제 완료: ${keys.length}개 키`);
      return { success: true, message: `${keys.length}개의 캐시 키가 삭제되었습니다.` };
    } else {
      console.log("ℹ️ 삭제할 Redis 캐시 키가 없습니다.");
      return { success: true, message: "삭제할 캐시 키가 없습니다." };
    }
  } catch (error) {
    console.error('Redis 캐시 삭제 오류:', error);
    return { success: false, message: `Redis 캐시 삭제 중 오류 발생: ${error instanceof Error ? error.message : String(error)}` };
  }
}