import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { redis } from '@/utils/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// [수정됨] DELETE 함수의 context 타입을 GET과 일치시키고 await 추가
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; // await를 사용하여 파라미터 추출
    if (!id) {
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
    }
    const cacheKey = `technical_article_${id}`;

    await redis.del(cacheKey);
    console.log(`✅ [CACHE INVALIDATED] Detailed article cache for ID: ${id}`);

    return NextResponse.json({ message: 'Detailed article cache invalidated successfully.' });
  } catch (error) {
    console.error('Redis detailed article cache invalidation error:', error);
    return NextResponse.json({ error: 'Failed to invalidate detailed article cache.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    
    // ID 유효성 검사
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
    }
    
    const cacheKey = `technical_article_${id}`;
    const cacheExpiry = 86400; // 24시간 (초 단위) - CRUD 작업 시에만 무효화

  // 1. Redis 캐시 확인
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(`✅ [CACHE HIT] Technical article ${id} fetched from Redis cache.`);
      const parsedData = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
      return NextResponse.json(parsedData);
    }
    console.log(`❌ [CACHE MISS] Technical article ${id}`);
  } catch (error) {
    console.error('Redis cache read error:', error);
  }

  // 2. Supabase에서 데이터 가져오기
  const supabase = createClient();
  const { data: articleData, error: articleError } = await (await supabase)
    .from('technical_articles')
    .select('*')
    .eq('id', id)
    .single();

  if (articleError) {
    console.error(`Error fetching article ${id}:`, articleError);
    if (articleError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }
    return NextResponse.json({ error: articleError.message }, { status: 500 });
  }

  if (!articleData) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  // 3. Redis에 데이터 저장
  try {
    await redis.setex(cacheKey, cacheExpiry, JSON.stringify(articleData));
    console.log(`✅ [CACHE SET] Technical article ${id} saved to Redis cache.`);
  } catch (error) {
    console.error('Redis cache write error:', error);
  }

  return NextResponse.json(articleData);
  
  } catch (error) {
    console.error('Unexpected error in technical article detail API:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}