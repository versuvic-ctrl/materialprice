import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { redis } from '@/utils/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/materials-by-category?level=1|2|3&categoryName=...
// Returns: [{ specification: string }, ...]
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const level = searchParams.get('level');
  const categoryName = searchParams.get('categoryName');

  if (!level || !categoryName) {
    return NextResponse.json({ error: 'Missing level or categoryName' }, { status: 400 });
  }

  // Map numeric level to RPC filters
  const filters: Record<string, string> = {};
  if (level === '1') filters.major = categoryName;
  else if (level === '2') filters.middle = categoryName;
  else if (level === '3') filters.sub = categoryName;
  else {
    return NextResponse.json({ error: 'Invalid level. Use 1|2|3' }, { status: 400 });
  }

  // Redis 캐시 키 생성
  const cacheKey = `materials_by_category:${level}:${categoryName}`;
  const cacheExpiry = 3600; // 1시간 (초 단위)

  // 1. Redis 캐시 확인
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(`Materials for level ${level}, category ${categoryName} fetched from Redis cache.`);
      const parsedData = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
      return NextResponse.json(parsedData);
    }
  } catch (error) {
    console.error('Redis cache read error:', error);
  }

  try {
    console.log(`Fetching materials for level ${level}, category: ${categoryName}`);
    
    const supabase = await createClient();
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 10000); // 10 second timeout
    });

    // Use RPC to fetch distinct specifications under the given filters
    const rpcPromise = supabase.rpc('get_distinct_categories', {
      p_level: 'specification',
      p_filters: filters,
    });

    // Race between RPC call and timeout
    const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as any;

    if (error) {
      console.error('Supabase RPC error:', error);
      
      // Handle specific timeout error
      if (error.code === '57014' || error.message?.includes('timeout')) {
        console.log('Query timeout detected, returning empty result');
        
        // 타임아웃 시에도 빈 배열을 짧은 시간 동안 캐시 (5분)
        try {
          await redis.setex(cacheKey, 300, JSON.stringify([]));
          console.log('Empty result cached due to timeout');
        } catch (cacheError) {
          console.error('Redis cache write error for timeout:', cacheError);
        }
        
        return NextResponse.json([], { status: 200 }); // Return empty array instead of error
      }
      
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Normalize to array of { specification } objects
    const specs = Array.isArray(data)
      ? data
          .map((item: any) => {
            if (typeof item === 'string') return { specification: item };
            if (item && typeof item.specification === 'string') return { specification: item.specification };
            if (item && typeof item.category === 'string') return { specification: item.category };
            return null;
          })
          .filter(Boolean)
          .slice(0, 100) // Limit results to prevent UI overload
      : [];

    console.log(`Found ${specs.length} specifications for ${categoryName}`);

    // 3. Redis에 데이터 저장
    try {
      await redis.setex(cacheKey, cacheExpiry, JSON.stringify(specs));
      console.log(`Materials for level ${level}, category ${categoryName} saved to Redis cache.`);
    } catch (error) {
      console.error('Redis cache write error:', error);
    }

    return NextResponse.json(specs);
    
  } catch (err: any) {
    console.error('Unexpected error:', err);
    
    // Handle timeout from Promise.race
    if (err.message === 'Request timeout') {
      console.log('Request timeout, returning empty result');
      
      // 타임아웃 시에도 빈 배열을 짧은 시간 동안 캐시 (5분)
      try {
        await redis.setex(cacheKey, 300, JSON.stringify([]));
        console.log('Empty result cached due to Promise.race timeout');
      } catch (cacheError) {
        console.error('Redis cache write error for Promise.race timeout:', cacheError);
      }
      
      return NextResponse.json([], { status: 200 }); // Return empty array instead of error
    }
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}