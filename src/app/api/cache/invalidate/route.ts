import { NextResponse } from 'next/server';
import { redis } from '@/utils/redis';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, materials, pattern } = body;

    let deletedKeys: string[] = [];
    let deletedCount = 0;

    switch (type) {
      case 'material_prices':
        // 자재 가격 캐시 삭제
        if (materials && Array.isArray(materials)) {
          // 특정 자재들의 캐시만 삭제
          const keys = await redis.keys('material_prices:*');
          for (const key of keys) {
            // 키에 포함된 자재명 확인
            const keyMaterials = key.split(':')[1]?.split(',') || [];
            const hasTargetMaterial = materials.some(material => 
              keyMaterials.some(keyMaterial => keyMaterial.includes(material))
            );
            if (hasTargetMaterial) {
              await redis.del(key);
              deletedKeys.push(key);
              deletedCount++;
            }
          }
        } else {
          // 모든 자재 가격 캐시 삭제
          const keys = await redis.keys('material_prices:*');
          if (keys.length > 0) {
            await redis.del(...keys);
            deletedKeys = keys;
            deletedCount = keys.length;
          }
        }
        break;

      case 'market_indicators':
        // 시장지표 캐시 삭제
        await redis.del('market_indicators');
        deletedKeys.push('market_indicators');
        deletedCount = 1;
        break;

      case 'all':
        // 모든 캐시 삭제
        const allKeys = await redis.keys('*');
        if (allKeys.length > 0) {
          await redis.del(...allKeys);
          deletedKeys = allKeys;
          deletedCount = allKeys.length;
        }
        break;

      case 'pattern':
        // 패턴 기반 캐시 삭제
        if (pattern) {
          const keys = await redis.keys(pattern);
          if (keys.length > 0) {
            await redis.del(...keys);
            deletedKeys = keys;
            deletedCount = keys.length;
          }
        }
        break;

      default:
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid cache invalidation type. Use: material_prices, market_indicators, all, or pattern' 
        }, { status: 400 });
    }

    console.log(`✅ Redis 캐시 무효화 완료: ${deletedCount}개 키 삭제`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Cache invalidated successfully`,
      type,
      deletedCount,
      deletedKeys: deletedKeys.slice(0, 10) // 처음 10개만 반환 (로그 크기 제한)
    });

  } catch (error) {
    console.error('❌ Cache invalidation error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to invalidate cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // 현재 캐시 상태 조회
    const materialPriceKeys = await redis.keys('material_prices:*');
    const marketIndicatorKeys = await redis.keys('market_indicators');
    const allKeys = await redis.keys('*');

    return NextResponse.json({
      success: true,
      cache_status: {
        material_prices: materialPriceKeys.length,
        market_indicators: marketIndicatorKeys.length,
        total_keys: allKeys.length,
        sample_keys: allKeys.slice(0, 5)
      }
    });
  } catch (error) {
    console.error('❌ Cache status check error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to check cache status' 
    }, { status: 500 });
  }
}