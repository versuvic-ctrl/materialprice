import { NextRequest, NextResponse } from 'next/server';
import { fetchMaterialPrices } from '@/utils/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ 
    error: 'GET method not supported. Use POST with materials, startDate, endDate, and interval in request body.' 
  }, { status: 405 });
}

export async function POST(request: NextRequest) {
  try {
    const { materials, startDate, endDate, interval } = await request.json();

    if (!materials || !Array.isArray(materials) || materials.length === 0) {
      return NextResponse.json(
        { error: 'Materials array is required' },
        { status: 400 }
      );
    }

    // 통합된 fetchMaterialPrices 함수 사용 (Redis 캐시 포함)
    const data = await fetchMaterialPrices(materials, startDate, endDate, interval);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in materials/prices API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch material prices' },
      { status: 500 }
    );
  }
}