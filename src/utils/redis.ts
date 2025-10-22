import { Redis } from "@upstash/redis";
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import * as fs from 'fs';
import * as path from 'path';

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
  const cacheExpiry = 864000; // 10일 (크롤링 주기 5일 + 5일 여유)

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


    // --- [수정된 부분 시작] ---
    // Supabase 클라이언트 생성 방식을 새로운 권장 방식으로 변경
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              // The `cookies().set()` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              // The `cookies().delete()` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    // --- [수정된 부분 끝] ---

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
      console.log(`✅ 자재 가격 데이터 Redis 캐시 저장: ${materials.length}개 자재 (10일 유지)`);
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

  // 2. public/market-indicators.json에서 데이터 조회
  const jsonFilePath = path.join(process.cwd(), 'public', 'market-indicators.json');

  if (fs.existsSync(jsonFilePath)) {
    const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
    const jsonData = JSON.parse(fileContent);
    const indicators = jsonData.data;

    if (indicators) {
      // 3. Redis에 데이터 저장
      try {
        await redis.setex(cacheKey, cacheExpiry, JSON.stringify(indicators));
      } catch (error) {
        console.error('Redis 캐시 저장 오류:', error);
      }
      return indicators;
    }
  }

  console.warn('market-indicators.json 파일을 찾을 수 없거나 데이터가 비어 있습니다.');
  return [];
}