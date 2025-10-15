import { Redis } from "@upstash/redis";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error("❌ Redis 환경 변수가 누락되었습니다.");
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * 통합된 자재 가격 데이터 페칭 함수
 * Redis 캐시를 우선 확인하고, 없으면 Supabase에서 조회 후 캐시에 저장
 */
export async function fetchMaterialPrices(
  materials: string[],
  startDate: string,
  endDate: string,
  interval: string
) {
  // 캐시 키 생성
  const sortedMaterials = [...materials].sort().join(',');
  const cacheKey = `material_prices:${sortedMaterials}:${startDate}:${endDate}:${interval}`;
  const cacheExpiry = 432000; // 5일 (크롤링 주기와 맞춤)

  // 1. Redis 캐시 확인
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(`✅ 자재 가격 데이터 Redis 캐시 히트: ${materials.length}개 자재`);
      return typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
    }
    console.log(`❌ 자재 가격 데이터 Redis 캐시 미스: ${materials.length}개 자재`);
  } catch (error) {
    console.error('Redis 캐시 조회 오류:', error);
  }

  // 2. Supabase에서 데이터 조회
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // 타임아웃 설정 (30초)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 30000);
    });

    const rpcPromise = supabase.rpc('get_material_prices', {
      material_names: materials,
      start_date_str: startDate,
      end_date_str: endDate,
      time_interval: interval,
    });

    const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as any;

    if (error) {
      console.error('Supabase 자재 가격 조회 오류:', error);
      throw error;
    }

    // 3. Redis에 데이터 저장
    try {
      await redis.setex(cacheKey, cacheExpiry, JSON.stringify(data));
      console.log(`✅ 자재 가격 데이터 Redis 캐시 저장: ${materials.length}개 자재 (5일 유지)`);
    } catch (cacheError) {
      console.error('Redis 캐시 저장 오류:', cacheError);
    }

    return data;
  } catch (error) {
    console.error('자재 가격 데이터 조회 실패:', error);
    throw error;
  }
}

/**
 * 시장지표 데이터 조회 (5시간 캐시 - 크롤링 간격에 맞춤)
 */
export async function fetchMarketIndicators() {
  const cacheKey = 'market_indicators';
  const cacheExpiry = 18000; // 5시간 (8시-1시 크롤링 간격에 맞춤)

  // 1. Redis 캐시 확인
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log('✅ 시장지표 데이터 Redis 캐시 히트');
      return typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
    }
  } catch (error) {
    console.error('Redis 캐시 조회 오류:', error);
  }

  // 2. Supabase에서 데이터 조회
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data, error } = await supabase
      .from('market_indicators')
      .select('*')
      .order('category', { ascending: true });

    if (error) {
      console.error('시장지표 조회 오류:', error);
      throw error;
    }

    const responseData = {
      success: true,
      data: data || [],
      lastUpdated: data?.[0]?.updated_at || null
    };

    // 3. Redis에 데이터 저장
    try {
      await redis.setex(cacheKey, cacheExpiry, JSON.stringify(responseData));
      console.log('✅ 시장지표 데이터 Redis 캐시 저장 (5시간 유지)');
    } catch (cacheError) {
      console.error('Redis 캐시 저장 오류:', cacheError);
    }

    return responseData;
  } catch (error) {
    console.error('시장지표 조회 실패:', error);
    throw error;
  }
}