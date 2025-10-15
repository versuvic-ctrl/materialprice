import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { redis } from '@/utils/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');

  if (!category) {
    return NextResponse.json({ error: 'Category is required' }, { status: 400 });
  }

  // Redis 캐시 키 생성
  const cacheKey = `materials:${category}`;
  const cacheExpiry = 3600; // 1시간 (초 단위)

  // 1. Redis 캐시 확인
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(`Materials for category ${category} fetched from Redis cache.`);
      const parsedData = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
      return NextResponse.json(parsedData);
    }
  } catch (error) {
    console.error('Redis cache read error:', error);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('category', category);

    if (error) {
      console.error('Error fetching materials:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. Redis에 데이터 저장
    try {
      await redis.setex(cacheKey, cacheExpiry, JSON.stringify(data || []));
      console.log(`Materials for category ${category} saved to Redis cache.`);
    } catch (cacheError) {
      console.error('Redis cache write error:', cacheError);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}