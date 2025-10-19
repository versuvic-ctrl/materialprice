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
    console.log('Cached data from Redis:', cachedData);
    if (cachedData) {
      console.log('Technical articles list fetched from Redis cache.');
      // cachedData가 문자열인 경우에만 JSON.parse를 적용
      const parsedData = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
      return NextResponse.json(parsedData);
    }
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

  // content에서 첫 번째 이미지 URL과 미리보기 텍스트를 추출하고 content는 빈 문자열로 설정
  const articlesWithEmptyContent = (data || []).map((article: any) => {
    // 이미지 URL 추출 (다양한 형태의 src 속성 지원)
    const imgMatch = article.content?.match(/<img[^>]+src\s*=\s*['"](.*?)['"][^>]*>/i);
    let preview_image = imgMatch ? imgMatch[1] : null;
    
    // Supabase Storage URL 처리 및 유효성 검사
    if (preview_image) {
      // Supabase Storage URL인지 확인 (article_images 버킷)
    if (preview_image.includes('/storage/v1/object/public/article_images/')) {
        // 이미 완전한 Supabase Storage URL인 경우 그대로 사용
        preview_image = preview_image;
      } else if (preview_image.startsWith('http') || preview_image.startsWith('data:')) {
        // 외부 URL이나 base64 이미지는 그대로 사용
        preview_image = preview_image;
      } else {
        // 상대 경로나 파일명만 있는 경우 null로 설정
        preview_image = null;
      }
    }
    
    // 미리보기 텍스트 추출 (HTML 태그 제거 후 첫 100자)
    let preview_text = '';
    if (article.content) {
      // HTML 태그 제거하고 공백 정리
      const textOnly = article.content
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
      
      preview_text = textOnly.length > 100 ? textOnly.substring(0, 100) + '...' : textOnly;
    }
    
    // 테이블 미리보기 추출
    const tableMatch = article.content?.match(/<table[^>]*>(?:.|\n)*?<\/table>/i);
    const preview_table = tableMatch ? tableMatch[0] : null;
    
    // 반환 객체에서 preview_text가 확실히 포함되도록 명시적으로 설정
    return {
      id: article.id,
      title: article.title,
      category: article.category,
      created_at: article.created_at,
      updated_at: article.updated_at,
      tags: article.tags,
      content: '', // 목록에서는 content를 비워둠
      preview_image: preview_image,
      preview_text: preview_text || `${article.category} 관련 기술자료`,
      preview_table: preview_table,
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

export async function DELETE() {
  const cacheKey = 'technical_articles_list';
  try {
    await redis.del(cacheKey);
    console.log('Technical articles list cache invalidated from Redis.');
    return NextResponse.json({ message: 'Cache invalidated successfully.' });
  } catch (error) {
    console.error('Redis cache invalidation error:', error);
    return NextResponse.json({ error: 'Failed to invalidate cache.' }, { status: 500 });
  }
}