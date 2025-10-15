import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/utils/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 배관 자재 가격 데이터베이스 (실제로는 데이터베이스에서 가져와야 함)
const PIPING_MATERIALS = {
  pipes: {
    'pipe-straight': {
      sizes: {
        '1"': { price: 15000, weight: 2.5, unit: 'm' },
        '2"': { price: 25000, weight: 4.2, unit: 'm' },
        '3"': { price: 35000, weight: 6.8, unit: 'm' },
        '4"': { price: 45000, weight: 9.5, unit: 'm' },
        '6"': { price: 65000, weight: 15.2, unit: 'm' },
        '8"': { price: 85000, weight: 22.8, unit: 'm' }
      },
      materials: {
        'CS': { multiplier: 1.0, description: 'Carbon Steel' },
        'SS304': { multiplier: 3.5, description: 'Stainless Steel 304' },
        'SS316': { multiplier: 4.2, description: 'Stainless Steel 316' },
        'AL': { multiplier: 2.1, description: 'Aluminum' }
      }
    }
  },
  fittings: {
    'elbow-90': {
      sizes: {
        '1"': { price: 8000, weight: 0.5, unit: 'ea' },
        '2"': { price: 12000, weight: 0.8, unit: 'ea' },
        '3"': { price: 18000, weight: 1.2, unit: 'ea' },
        '4"': { price: 25000, weight: 1.8, unit: 'ea' },
        '6"': { price: 35000, weight: 3.2, unit: 'ea' },
        '8"': { price: 45000, weight: 5.5, unit: 'ea' }
      },
      materials: {
        'CS': { multiplier: 1.0, description: 'Carbon Steel' },
        'SS304': { multiplier: 3.5, description: 'Stainless Steel 304' },
        'SS316': { multiplier: 4.2, description: 'Stainless Steel 316' },
        'AL': { multiplier: 2.1, description: 'Aluminum' }
      }
    },
    'elbow-45': {
      sizes: {
        '1"': { price: 7000, weight: 0.4, unit: 'ea' },
        '2"': { price: 10000, weight: 0.7, unit: 'ea' },
        '3"': { price: 15000, weight: 1.0, unit: 'ea' },
        '4"': { price: 20000, weight: 1.5, unit: 'ea' },
        '6"': { price: 28000, weight: 2.8, unit: 'ea' },
        '8"': { price: 38000, weight: 4.8, unit: 'ea' }
      },
      materials: {
        'CS': { multiplier: 1.0, description: 'Carbon Steel' },
        'SS304': { multiplier: 3.5, description: 'Stainless Steel 304' },
        'SS316': { multiplier: 4.2, description: 'Stainless Steel 316' },
        'AL': { multiplier: 2.1, description: 'Aluminum' }
      }
    },
    'tee': {
      sizes: {
        '1"': { price: 12000, weight: 0.7, unit: 'ea' },
        '2"': { price: 18000, weight: 1.2, unit: 'ea' },
        '3"': { price: 28000, weight: 1.8, unit: 'ea' },
        '4"': { price: 38000, weight: 2.8, unit: 'ea' },
        '6"': { price: 55000, weight: 4.8, unit: 'ea' },
        '8"': { price: 75000, weight: 8.2, unit: 'ea' }
      },
      materials: {
        'CS': { multiplier: 1.0, description: 'Carbon Steel' },
        'SS304': { multiplier: 3.5, description: 'Stainless Steel 304' },
        'SS316': { multiplier: 4.2, description: 'Stainless Steel 316' },
        'AL': { multiplier: 2.1, description: 'Aluminum' }
      }
    },
    'flange': {
      sizes: {
        '1"': { price: 15000, weight: 1.2, unit: 'ea' },
        '2"': { price: 22000, weight: 2.1, unit: 'ea' },
        '3"': { price: 32000, weight: 3.5, unit: 'ea' },
        '4"': { price: 45000, weight: 5.2, unit: 'ea' },
        '6"': { price: 68000, weight: 8.8, unit: 'ea' },
        '8"': { price: 95000, weight: 15.2, unit: 'ea' }
      },
      materials: {
        'CS': { multiplier: 1.0, description: 'Carbon Steel' },
        'SS304': { multiplier: 3.5, description: 'Stainless Steel 304' },
        'SS316': { multiplier: 4.2, description: 'Stainless Steel 316' },
        'AL': { multiplier: 2.1, description: 'Aluminum' }
      }
    }
  },
  valves: {
    'gate-valve': {
      sizes: {
        '1"': { price: 85000, weight: 3.5, unit: 'ea' },
        '2"': { price: 125000, weight: 6.2, unit: 'ea' },
        '3"': { price: 185000, weight: 12.5, unit: 'ea' },
        '4"': { price: 265000, weight: 18.8, unit: 'ea' },
        '6"': { price: 385000, weight: 32.5, unit: 'ea' },
        '8"': { price: 525000, weight: 52.8, unit: 'ea' }
      },
      materials: {
        'CS': { multiplier: 1.0, description: 'Carbon Steel' },
        'SS304': { multiplier: 3.5, description: 'Stainless Steel 304' },
        'SS316': { multiplier: 4.2, description: 'Stainless Steel 316' },
        'AL': { multiplier: 2.1, description: 'Aluminum' }
      }
    },
    'ball-valve': {
      sizes: {
        '1"': { price: 95000, weight: 2.8, unit: 'ea' },
        '2"': { price: 145000, weight: 4.5, unit: 'ea' },
        '3"': { price: 215000, weight: 8.2, unit: 'ea' },
        '4"': { price: 295000, weight: 12.8, unit: 'ea' },
        '6"': { price: 425000, weight: 22.5, unit: 'ea' },
        '8"': { price: 585000, weight: 38.2, unit: 'ea' }
      },
      materials: {
        'CS': { multiplier: 1.0, description: 'Carbon Steel' },
        'SS304': { multiplier: 3.5, description: 'Stainless Steel 304' },
        'SS316': { multiplier: 4.2, description: 'Stainless Steel 316' },
        'AL': { multiplier: 2.1, description: 'Aluminum' }
      }
    }
  }
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const itemType = searchParams.get('itemType');
  const size = searchParams.get('size');
  const material = searchParams.get('material');

  // Redis 캐시 키 생성
  const cacheKey = `piping_materials:${category || 'all'}:${itemType || 'all'}:${size || 'all'}:${material || 'all'}`;
  const cacheExpiry = 7200; // 2시간 (초 단위) - 정적 데이터이므로 길게 설정

  // 1. Redis 캐시 확인
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(`Piping materials data fetched from Redis cache for key: ${cacheKey}`);
      const parsedData = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
      return NextResponse.json(parsedData);
    }
  } catch (error) {
    console.error('Redis cache read error:', error);
  }

  try {
    // 전체 자재 목록 반환
    if (!category) {
      const responseData = {
        success: true,
        data: PIPING_MATERIALS
      };

      // Redis에 데이터 저장
      try {
        await redis.setex(cacheKey, cacheExpiry, JSON.stringify(responseData));
        console.log(`Piping materials (all) saved to Redis cache.`);
      } catch (cacheError) {
        console.error('Redis cache write error:', cacheError);
      }

      return NextResponse.json(responseData);
    }

    // 특정 카테고리의 자재 반환
    if (category && !itemType) {
      const categoryData = PIPING_MATERIALS[category as keyof typeof PIPING_MATERIALS];
      if (!categoryData) {
        return NextResponse.json(
          { success: false, error: 'Category not found' },
          { status: 404 }
        );
      }

      const responseData = {
        success: true,
        data: categoryData
      };

      // Redis에 데이터 저장
      try {
        await redis.setex(cacheKey, cacheExpiry, JSON.stringify(responseData));
        console.log(`Piping materials (category: ${category}) saved to Redis cache.`);
      } catch (cacheError) {
        console.error('Redis cache write error:', cacheError);
      }

      return NextResponse.json(responseData);
    }

    // 특정 아이템의 가격 정보 반환
    if (category && itemType) {
      const categoryData = PIPING_MATERIALS[category as keyof typeof PIPING_MATERIALS];
      if (!categoryData) {
        return NextResponse.json(
          { success: false, error: 'Category not found' },
          { status: 404 }
        );
      }

      const itemData = categoryData[itemType as keyof typeof categoryData];
      if (!itemData) {
        return NextResponse.json(
          { success: false, error: 'Item type not found' },
          { status: 404 }
        );
      }

      // 특정 사이즈와 재질의 가격 계산
      if (size && material) {
        const sizeData = (itemData as any).sizes?.[size];
        const materialData = (itemData as any).materials?.[material];
        
        if (!sizeData || !materialData) {
          return NextResponse.json(
            { success: false, error: 'Size or material not found' },
            { status: 404 }
          );
        }

        const finalPrice = Math.round(sizeData.price * materialData.multiplier);
        const finalWeight = sizeData.weight;

        const responseData = {
          success: true,
          data: {
            price: finalPrice,
            weight: finalWeight,
            unit: sizeData.unit,
            material: materialData.description,
            size: size
          }
        };

        // Redis에 데이터 저장
        try {
          await redis.setex(cacheKey, cacheExpiry, JSON.stringify(responseData));
          console.log(`Piping materials (specific item: ${category}/${itemType}/${size}/${material}) saved to Redis cache.`);
        } catch (cacheError) {
          console.error('Redis cache write error:', cacheError);
        }

        return NextResponse.json(responseData);
      }

      const responseData = {
        success: true,
        data: itemData
      };

      // Redis에 데이터 저장
      try {
        await redis.setex(cacheKey, cacheExpiry, JSON.stringify(responseData));
        console.log(`Piping materials (item: ${category}/${itemType}) saved to Redis cache.`);
      } catch (cacheError) {
        console.error('Redis cache write error:', cacheError);
      }

      return NextResponse.json(responseData);
    }

    return NextResponse.json(
      { success: false, error: 'Invalid parameters' },
      { status: 400 }
    );

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST 요청으로 BOM 데이터 처리
export async function POST(request: NextRequest) {
  try {
    const bomData = await request.json();
    
    // BOM 데이터 검증 및 가격 계산
    interface BOMItem {
      type: string;
      subtype: string;
      size: string;
      material: string;
      quantity: number;
      [key: string]: unknown;
    }
    
    const processedBOM = bomData.map((item: BOMItem) => {
      const category = getCategoryFromItemType(item.type);
      const categoryData = PIPING_MATERIALS[category as keyof typeof PIPING_MATERIALS];
      
      if (categoryData && categoryData[item.subtype as keyof typeof categoryData]) {
        const itemData = categoryData[item.subtype as keyof typeof categoryData];
        const sizeData = (itemData as any).sizes?.[item.size];
        const materialData = (itemData as any).materials?.[item.material];
        
        if (sizeData && materialData) {
          const price = Math.round(sizeData.price * materialData.multiplier);
          const weight = sizeData.weight;
          
          return {
            ...item,
            price,
            weight,
            totalPrice: price * item.quantity,
            totalWeight: weight * item.quantity
          };
        }
      }
      
      return {
        ...item,
        price: 0,
        weight: 0,
        totalPrice: 0,
        totalWeight: 0
      };
    });

    const totalCost = processedBOM.reduce((sum: number, item: BOMItem & { totalPrice: number }) => sum + item.totalPrice, 0);
    const totalWeight = processedBOM.reduce((sum: number, item: BOMItem & { totalWeight: number }) => sum + item.totalWeight, 0);

    return NextResponse.json({
      success: true,
      data: {
        items: processedBOM,
        summary: {
          totalCost,
          totalWeight,
          itemCount: processedBOM.length
        }
      }
    });

  } catch (error) {
    console.error('BOM Processing Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process BOM data' },
      { status: 500 }
    );
  }
}

// 아이템 타입에서 카테고리 추출하는 헬퍼 함수
function getCategoryFromItemType(itemType: string): string {
  if (itemType.includes('pipe')) return 'pipes';
  if (itemType.includes('valve')) return 'valves';
  if (['elbow', 'tee', 'cross', 'cap', 'coupling', 'union', 'flange'].some(type => itemType.includes(type))) {
    return 'fittings';
  }
  return 'equipment';
}