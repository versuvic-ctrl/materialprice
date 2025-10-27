import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { redis } from '@/utils/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const cacheKey = 'technical_articles_list';
  const cacheExpiry = 86400; // 24시간 (초 단위) - CRUD 작업 시에만 무효화

  // 1. Redis 캐시 확인
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log('✅ [CACHE HIT] Technical articles list fetched from Redis cache.');
      const parsedData = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
      return NextResponse.json(parsedData);
    }
    console.log('❌ [CACHE MISS] Technical articles list');
  } catch (error) {
    console.error('Redis cache read error:', error);
  }

  // 2. Supabase에서 데이터 가져오기
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('technical_articles')
    .select('id, title, category, created_at, updated_at, tags, content')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // content에서 미리보기 데이터 추출
  const articlesWithEmptyContent = (data || []).map((article: any) => {
    const imgMatch = article.content?.match(/<img[^>]+src\s*=\s*['"](.*?)['"][^>]*>/i);
    let preview_image = imgMatch ? imgMatch[1] : null;
    
    if (preview_image) {
      if (preview_image.includes('/storage/v1/object/public/article_images/')) {
        preview_image = preview_image;
      } else if (preview_image.startsWith('http') || preview_image.startsWith('data:')) {
        preview_image = preview_image;
      } else {
        preview_image = null;
      }
    }
    
    let preview_text = '';
    if (article.content) {
      const textOnly = article.content
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      preview_text = textOnly.length > 100 ? textOnly.substring(0, 100) + '...' : textOnly;
    }
    
    const tableMatch = article.content?.match(/<table[^>]*>(?:.|\n)*?<\/table>/i);
    const preview_table = tableMatch ? tableMatch[0] : null;
    
    return {
      id: article.id,
      title: article.title,
      category: article.category,
      created_at: article.created_at,
      updated_at: article.updated_at,
      tags: article.tags,
      content: '',
      preview_image: preview_image,
      preview_text: preview_text || `${article.category} 관련 기술자료`,
      preview_table: preview_table,
    };
  });

  // 3. Redis에 데이터 저장
  try {
    await redis.setex(cacheKey, cacheExpiry, JSON.stringify(articlesWithEmptyContent));
    console.log('✅ [CACHE SET] Technical articles list saved to Redis cache.');
  } catch (error) {
    console.error('Redis cache write error:', error);
  }

  return NextResponse.json(articlesWithEmptyContent);
}

export async function DELETE() {
  const cacheKey = 'technical_articles_list';
  try {
    await redis.del(cacheKey);
    console.log('✅ [CACHE INVALIDATED] Technical articles list cache invalidated from Redis.');
    return NextResponse.json({ message: 'Cache invalidated successfully.' });
  } catch (error) {
    console.error('Redis cache invalidation error:', error);
    return NextResponse.json({ error: 'Failed to invalidate cache.' }, { status: 500 });
  }
}