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
  changerate: number;
  category: string;
  unit: string;
}

// ==========================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ 스크래핑 함수를 전면 수정했습니다 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// ==========================================================
async function scrapeMarketIndicators(html: string): Promise<MarketIndicator[]> {
  const $ = load(html);
  const marketIndicators: MarketIndicator[] = [];

  // 새로운 테이블 선택자: .tbl_indicator
  $('.tbl_indicator tbody tr').each((i, el) => {
    const category = $(el).find('th[class^="th_indi"] a span').text().trim();
    const name = $(el).find('th[class^="th_type"] a').text().trim();

    // 값과 단위 추출
    const valueCell = $(el).find('td').eq(0);
    const unit = valueCell.find('span').text().trim();
    const valueText = valueCell.text().replace(unit, '').replace(/,/g, '').trim();
    const value = parseFloat(valueText);

    // 변동값 추출
    const changeCell = $(el).find('td').eq(1);
    const changeDirection = changeCell.find('img').attr('alt');
    const changeText = changeCell.text().trim();
    let change = parseFloat(changeText);
    
    // 유효성 검사
    if (category && name && !isNaN(value)) {
      if (changeDirection === '하락') {
        change *= -1;
      }

      marketIndicators.push({
        name,
        category,
        value,
        unit,
        change: isNaN(change) ? 0 : change,
        changerate: 0, // 변동률은 이 테이블에 없으므로 0으로 고정
      });
    }
  });

  console.log(`스크래핑 완료: ${marketIndicators.length}개 지표를 찾았습니다.`);
  return marketIndicators;
}
// ==========================================================
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
// ==========================================================


const CACHE_KEY = 'marketIndicators';
const CACHE_EXPIRATION_SECONDS = 86400; // 24시간 캐시 유지

// GET 함수는 수정할 필요 없습니다.
export async function GET(request: NextRequest) {
  try {
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

// POST 함수는 URL만 변경합니다.
export async function POST() {
  try {
    // ==========================================================
    // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ 크롤링 URL을 수정했습니다 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
    // ==========================================================
    const response = await fetch('https://finance.naver.com/marketindex/interestDetail.naver?marketindexCd=IRR_CD91', {
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
    const arrayBuffer = await response.arrayBuffer();
    const decoder = new TextDecoder('euc-kr');
    const html = decoder.decode(arrayBuffer);

    const indicators = await scrapeMarketIndicators(html);
    
    if (indicators.length === 0) {
      console.error('No market indicators found after scraping.');
      return NextResponse.json({ success: false, error: 'No market indicators found' }, { status: 404 });
    }

    // Redis에만 데이터 저장
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