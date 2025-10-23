// src/app/api/market-indicators/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { redis } from '@/utils/redis';
import { load } from 'cheerio';


export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface MarketIndicator {
  name: string;
  value: number;
  change: number;
  changerate: number; // 변동률 필드는 유지하되, 현재 스크래핑 대상에는 없으므로 0으로 채웁니다.
  category: string;
  unit: string;
}

// ==========================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ [핵심 수정] 스크래핑 함수 로직 수정 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// 네이버 금융 메인 페이지의 HTML 구조에 맞게 재작성되었습니다.
// ==========================================================
async function scrapeMarketIndicators(html: string): Promise<MarketIndicator[]> {
  const $ = load(html);
  const marketIndicators: MarketIndicator[] = [];

  // 주요 시장 지표가 있는 오른쪽 사이드바의 테이블을 선택합니다.
  $('#marketindex_aside .tbl_home tbody tr').each((i, el) => {
    const category = $(el).find('th a').text().trim();
    const name = $(el).find('td a').text().trim();

    // 값과 단위를 포함한 셀
    const valueCell = $(el).find('td').first();
    const valueText = valueCell.text().replace(name, '').replace(/,/g, '').trim();
    
    // 값과 단위 분리 (예: "1438.60원" -> 1438.60, "원")
    const valueMatch = valueText.match(/([\d,.]+)(.*)/);
    const value = valueMatch ? parseFloat(valueMatch[1]) : NaN;
    const unit = valueMatch && valueMatch[2] ? valueMatch[2].trim() : '';

    // 변동값 추출
    const changeCell = $(el).find('td').eq(1);
    const changeDirection = changeCell.find('img').attr('alt'); // '상승', '하락' 등의 alt 텍스트
    const changeText = changeCell.text().trim();
    let change = parseFloat(changeText.replace(/,/g, ''));

    // 유효성 검사
    if (category && name && !isNaN(value)) {
      // '하락'일 경우 변동값을 음수로 만듭니다.
      if (changeDirection === '하락' && change > 0) {
        change *= -1;
      }

      marketIndicators.push({
        name,
        category,
        value,
        unit,
        change: isNaN(change) ? 0 : change,
        changerate: 0, // 이 테이블에는 변동률 정보가 없으므로 0으로 고정합니다.
      });
    }
  });

  console.log(`스크래핑 완료: ${marketIndicators.length}개 지표를 찾았습니다.`);
  return marketIndicators;
}
// ==========================================================
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
// ==========================================================


// [수정] 캐시 키를 'market_indicators'로 통일합니다.
const CACHE_KEY = 'market_indicators';
const CACHE_EXPIRATION_SECONDS = 86400; // 24시간 캐시 유지

export async function GET(request: NextRequest) {
  try {
    // [수정] 통일된 캐시 키로 조회합니다.
    const cachedData = await redis.get(CACHE_KEY);
    if (cachedData) {
      const dataToReturn = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
      console.log('✅ Market indicators fetched from Redis cache.');
      return NextResponse.json(dataToReturn);
    }
    
    console.log('❌ Market indicators cache miss, returning empty array for now.');
    return NextResponse.json([]);

  } catch (error) {
    console.error('Error in GET /api/market-indicators:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Internal server error: ${errorMessage}` }, { status: 500 });
  }
}

export async function POST() {
  try {
    // ==========================================================
    // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ [핵심 수정] 크롤링 URL 수정 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
    // ==========================================================
    const response = await fetch('https://finance.naver.com/marketindex/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    // ==========================================================
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
    // ==========================================================

    if (!response.ok) {
        throw new Error(`Failed to fetch Naver Finance: ${response.statusText}`);
    }
    // 네이버 금융은 'euc-kr' 인코딩을 사용합니다.
    const arrayBuffer = await response.arrayBuffer();
    const decoder = new TextDecoder('euc-kr');
    const html = decoder.decode(arrayBuffer);

    const indicators = await scrapeMarketIndicators(html);
    
    if (indicators.length === 0) {
      console.error('No market indicators found after scraping.');
      return NextResponse.json({ success: false, error: 'No market indicators found' }, { status: 404 });
    }

    // [수정] 통일된 캐시 키로 Redis에 데이터를 저장합니다.
    await redis.setex(CACHE_KEY, CACHE_EXPIRATION_SECONDS, JSON.stringify(indicators));
    console.log(`Redis cache updated successfully with ${indicators.length} items.`);

    return NextResponse.json({
      success: true,
      message: `Successfully scraped and cached ${indicators.length} market indicators in Redis.`,
      data: indicators
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating market indicators:', errorMessage);
    return NextResponse.json({ success: false, error: `Failed to update market indicators: ${errorMessage}` }, { status: 500 });
  }
}