/**
 * redis-cache.ts - 프론트엔드 Redis 캐시 유틸리티
 * 
 * 기능:
 * - Supabase API 호출 시 Redis 캐시 레이어 제공
 * - 24시간 TTL로 자재 데이터 캐싱
 * - API 호출 횟수 절약 및 성능 향상
 * 
 * 사용처:
 * - components/dashboard/DashboardMiniChart.tsx
 * - lib/supabase.ts의 데이터 조회 함수들
 * - API 라우트에서 Supabase 조회 전 캐시 확인
 * 
 * 중요도: ⭐⭐⭐ 필수 - API 호출 최적화의 핵심
 */

// Redis REST API 설정
const REDIS_REST_URL = process.env.REDIS_REST_URL || process.env.NEXT_PUBLIC_REDIS_REST_URL;
const REDIS_REST_TOKEN = process.env.REDIS_REST_TOKEN || process.env.NEXT_PUBLIC_REDIS_REST_TOKEN;

// 캐시 TTL (24시간)
const CACHE_TTL = 24 * 60 * 60; // 86400초

// 캐시 키 생성 함수
export const generateCacheKey = (
  table: string,
  filters: Record<string, any> = {},
  select?: string
): string => {
  const filterStr = Object.entries(filters)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');
  
  const selectStr = select ? `select:${select}` : '';
  
  return `supabase:${table}:${filterStr}:${selectStr}`.replace(/\s+/g, '_');
};

// Redis에서 데이터 조회
export const getFromCache = async (key: string): Promise<any | null> => {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) {
    console.warn('Redis 설정이 없습니다. 캐시를 사용하지 않습니다.');
    return null;
  }

  try {
    const response = await fetch(`${REDIS_REST_URL}/get/${key}`, {
      headers: {
        'Authorization': `Bearer ${REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.result) {
        console.log(`캐시 HIT: ${key}`);
        return JSON.parse(data.result);
      }
    }
    
    console.log(`캐시 MISS: ${key}`);
    return null;
  } catch (error) {
    console.warn('Redis 조회 실패:', error);
    return null;
  }
};

// Redis에 데이터 저장
export const setToCache = async (
  key: string, 
  data: any, 
  ttl: number = CACHE_TTL
): Promise<boolean> => {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) {
    return false;
  }

  try {
    const response = await fetch(`${REDIS_REST_URL}/set/${key}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        value: JSON.stringify(data),
        ex: ttl, // TTL 설정
      }),
    });

    if (response.ok) {
      console.log(`캐시 저장 성공: ${key} (TTL: ${ttl}초)`);
      return true;
    } else {
      console.warn(`캐시 저장 실패: ${key}`, response.status);
      return false;
    }
  } catch (error) {
    console.warn('Redis 저장 실패:', error);
    return false;
  }
};

// 캐시된 Supabase 조회 함수
export const cachedSupabaseQuery = async <T>(
  queryFn: () => Promise<T>,
  cacheKey: string,
  ttl: number = CACHE_TTL
): Promise<T> => {
  // 1. 캐시에서 먼저 조회
  const cachedData = await getFromCache(cacheKey);
  if (cachedData !== null) {
    return cachedData as T;
  }

  // 2. 캐시에 없으면 Supabase에서 조회
  const freshData = await queryFn();

  // 3. 조회 결과를 캐시에 저장
  await setToCache(cacheKey, freshData, ttl);

  return freshData;
};

// 특정 패턴의 캐시 키 삭제 (데이터 업데이트 시 사용)
export const invalidateCache = async (pattern: string): Promise<void> => {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) {
    return;
  }

  try {
    // Redis SCAN을 사용하여 패턴 매칭 키 찾기
    const response = await fetch(`${REDIS_REST_URL}/keys/${pattern}*`, {
      headers: {
        'Authorization': `Bearer ${REDIS_REST_TOKEN}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const keys = data.result || [];

      // 찾은 키들을 모두 삭제
      for (const key of keys) {
        await fetch(`${REDIS_REST_URL}/del/${key}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${REDIS_REST_TOKEN}`,
          },
        });
      }

      console.log(`캐시 무효화 완료: ${keys.length}개 키 삭제`);
    }
  } catch (error) {
    console.warn('캐시 무효화 실패:', error);
  }
};

// 자재 데이터 전용 캐시 함수들
export const getMaterialDataFromCache = async (
  specifications: string[],
  startDate: string,
  endDate: string,
  interval: string
) => {
  const key = generateCacheKey('kpi_price_data', {
    specifications: specifications.sort().join(','),
    startDate,
    endDate,
    interval,
  });

  return await getFromCache(key);
};

export const setMaterialDataToCache = async (
  specifications: string[],
  startDate: string,
  endDate: string,
  interval: string,
  data: any
) => {
  const key = generateCacheKey('kpi_price_data', {
    specifications: specifications.sort().join(','),
    startDate,
    endDate,
    interval,
  });

  return await setToCache(key, data);
};