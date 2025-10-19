import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { redis } from '@/utils/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    
    // ID 유효성 검사
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
    }
    
    const cacheKey = `technical_article_${id}`;
    const cacheExpiry = 3600; // 1시간 (초 단위)

  // 1. Redis 캐시 확인
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(`Technical article ${id} fetched from Redis cache.`);
      // cachedData가 문자열인 경우에만 JSON.parse를 적용
      const parsedData = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
      return NextResponse.json(parsedData);
    }
  } catch (error) {
    console.error('Redis cache read error:', error);
  }

  // 2. Supabase에서 데이터 가져오기
  const supabase = createClient(); // createClient() 호출을 try 블록 안으로 이동
  const { data: articleData, error: articleError } = await (await supabase)
    .from('technical_articles')
    .select('*') // 모든 필드 가져오기
    .eq('id', id)
    .single();

  if (articleError) {
    console.error(`Error fetching article ${id}:`, articleError);
    console.error('Supabase error details:', articleError);
    // PGRST116 에러는 데이터가 없음을 의미하므로 404 Not Found로 처리
    if (articleError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }
    return NextResponse.json({ error: articleError.message }, { status: 500 });
  }

  // articleData가 null인 경우 (위에서 PGRST116으로 처리되므로 이 블록은 사실상 도달하지 않음)
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
  
  } catch (error) {
    console.error('Unexpected error in technical article detail API:', error);
    console.error('Full error object:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}