import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { redis } from '@/utils/redis';

export async function GET(request: Request) {
  console.log('=== API Categories Route Started ===');
  console.log('Request URL:', request.url);
  
  const { searchParams } = new URL(request.url);
  const level = searchParams.get('level');
  console.log('Level parameter:', level);
  
  let filters: any = {};
  try {
    const filtersParam = searchParams.get('filters') || '{}';
    console.log('Raw filters parameter:', filtersParam);
    filters = JSON.parse(filtersParam);
    console.log('Parsed filters:', filters);
  } catch (e) {
    console.error('Failed to parse filters parameter:', e);
    return NextResponse.json({ error: 'Invalid filters parameter' }, { status: 400 });
  }

  if (!level) {
    console.error('Level parameter is missing');
    return NextResponse.json({ error: 'Level parameter is required' }, { status: 400 });
  }

  console.log('Checking Redis cache...');
  const cacheKey = `categories:${level}:${JSON.stringify(filters)}`;
  console.log('Cache key:', cacheKey);
  
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log('Cache hit! Returning cached data');
      return NextResponse.json(JSON.parse(cachedData as string));
    }
    console.log('Cache miss, proceeding to database query');
  } catch (redisError) {
    console.error('Redis error:', redisError);
    // Redis 에러가 있어도 계속 진행
  }

  console.log('Creating Supabase client...');
  const supabase = createClient();
  
  try {
    console.log('Calling Supabase RPC with params:', { p_level: level, p_filters: filters });
    const client = await supabase;
    const { data, error } = await client.rpc('get_distinct_categories', {
      p_level: level,
      p_filters: filters
    });

    console.log('Supabase RPC response - data:', data);
    console.log('Supabase RPC response - error:', error);

    if (error) {
      console.error(`Supabase RPC error (level: ${level}):`, error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Processing data...');
    let categories: string[] = [];
    if (Array.isArray(data)) {
      categories = data.map((item: any) => {
        if (typeof item === 'string') return item;
        if (item?.category) return item.category;
        return String(item);
      });
    }
    console.log('Processed categories:', categories);

    const uniqueCategories = [...new Set(categories)];
    console.log('Unique categories:', uniqueCategories);
    
    const sortedCategories = sortKorean(uniqueCategories);
    console.log('Sorted categories:', sortedCategories);
    
    console.log('Saving to Redis cache...');
    try {
      await redis.setex(cacheKey, 43200, JSON.stringify(sortedCategories)); // 12시간 캐시
      console.log('Successfully saved to Redis cache');
    } catch (redisSetError) {
      console.error('Redis set error:', redisSetError);
      // Redis 저장 실패해도 계속 진행
    }

    console.log('Returning response with', sortedCategories.length, 'categories');
    return NextResponse.json(sortedCategories);
  } catch (error: any) {
    console.error(`API route error (level: ${level}):`, error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// 한글 자음 순서로 배열을 정렬하는 유틸리티 함수
// 카테고리 목록을 사용자가 찾기 쉽도록 가나다 순으로 정렬
const sortKorean = (arr: string[]) => {
  return arr.sort((a, b) => {
    return a.localeCompare(b, 'ko-KR', { 
      numeric: true, 
      sensitivity: 'base' 
    });
  });
};