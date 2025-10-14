import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { redis } from '@/utils/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const cacheKey = `technical_article_${id}`;
  const cacheExpiry = 3600; // 1시간 (초 단위)

  // 1. Redis 캐시 확인
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(`Technical article ${id} fetched from Redis cache.`);
      return NextResponse.json(JSON.parse(cachedData as string));
    }
  } catch (error) {
    console.error('Redis cache read error:', error);
  }

  // 2. Supabase에서 데이터 가져오기
  const supabase = await createClient();
  const { data: articleData, error: articleError } = await supabase
    .from('technical_articles')
    .select('*') // 모든 필드 가져오기
    .eq('id', id)
    .single();

  if (articleError) {
    console.error(`Error fetching article ${id}:`, articleError); 
    return NextResponse.json({ error: articleError.message }, { status: 500 });
  }

  if (!articleData) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  // 3. Redis에 데이터 저장
  try {
    await redis.setex(cacheKey, cacheExpiry, JSON.stringify(articleData));
    console.log(`Technical article ${id} saved to Redis cache.`);
  } catch (error) {
    console.error('Redis cache write error:', error);
  }

  return NextResponse.json(articleData);
}