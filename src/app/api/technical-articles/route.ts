import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { redis } from '@/utils/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const cacheKey = 'technical_articles_list';
  const cacheExpiry = 3600; // 1시간 (초 단위)

  // 1. Redis 캐시 확인
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log('Technical articles list fetched from Redis cache.');
      return NextResponse.json(JSON.parse(cachedData as string));
    }
  } catch (error) {
    console.error('Redis cache read error:', error);
  }

  // 2. Supabase에서 데이터 가져오기
  const supabase = createClient();
  const { data, error } = await (await supabase)
    .from('technical_articles')
    .select('id, title, category, created_at, updated_at, tags, content')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // content에서 첫 번째 이미지 URL을 추출하고 content는 빈 문자열로 설정
  const articlesWithEmptyContent = (data || []).map((article: any) => {
    const imgMatch = article.content?.match(/<img[^>]+src=\"([^\"]+)\"/i);
    const preview_image = imgMatch ? imgMatch[1] : null;
    
    return {
      ...article,
      content: '', // 목록에서는 content를 비워둠
      preview_image: preview_image,
    };
  });

  // 3. Redis에 데이터 저장
  try {
    await redis.setex(cacheKey, cacheExpiry, JSON.stringify(articlesWithEmptyContent));
    console.log('Technical articles list saved to Redis cache.');
  } catch (error) {
    console.error('Redis cache write error:', error);
  }

  return NextResponse.json(articlesWithEmptyContent);
}