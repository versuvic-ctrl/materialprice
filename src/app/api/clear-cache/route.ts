import { NextResponse } from 'next/server';
import { redis } from '@/utils/redis';

export async function POST() {
  try {
    // 기술자료 관련 캐시 키들 삭제
    const cacheKeys = [
      'technical_articles_list',
      'technical_articles:*'
    ];

    for (const key of cacheKeys) {
      if (key.includes('*')) {
        // 패턴 매칭으로 키 삭제
        const keys = await redis.keys(key);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } else {
        await redis.del(key);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Cache cleared successfully',
      clearedKeys: cacheKeys
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to clear cache' 
    }, { status: 500 });
  }
}