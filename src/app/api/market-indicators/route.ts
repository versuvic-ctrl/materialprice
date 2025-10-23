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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ 스크래핑 함수 수정 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// ==========================================================
async function scrapeMarketIndicators(html: string): Promise<MarketIndicator[]> {
  const $ = load(html);
  const marketIndicators: MarketIndicator[] = [];

  // 메인 시장 지표 테이블 선택
  $('#marketindex_aside .tbl_home').first().find('tbody tr').each((i, el) => {
    const category = $(el).find('th a').text().trim();
    const link = $(el).find('td a');
    const name = link.text().trim();

    // 값, 단위, 변동, 변동률 추출
    const valueText = link.next().text().trim(); // a 태그 바로 다음 텍스트 노드
    const changeText = $(el).find('td').eq(1).text().trim();
    const changerateText = $(el).find('td').eq(2).text().trim().replace('%', '');

    // 숫자와 단위 분리
    const valueMatch = valueText.match(/([\d,.]+)(.*)/);
    const value = valueMatch ? parseFloat(valueMatch[1].replace(/,/g, '')) : NaN;
    const unit = valueMatch ? valueMatch[2].trim() : '';
    
    const change = parseFloat(changeText.replace(/,/g, ''));
    const changerate = parseFloat(changerateText);

    if (category && name && !isNaN(value)) {
      marketIndicators.push({
        name,
        category,
        value,
        unit,
        change: isNaN(change) ? 0 : change,
        changerate: isNaN(changerate) ? 0 : changerate,
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

// GET 함수는 그대로 사용
export async function GET(request: NextRequest) {
  // ... (기존 코드와 동일)
}

// POST 함수는 URL만 변경
export async function POST() {
  try {
    // ==========================================================
    // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ 크롤링 URL 수정 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
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
    const arrayBuffer = await response.arrayBuffer();
    const decoder = new TextDecoder('euc-kr');
    const html = decoder.decode(arrayBuffer);

    const indicators = await scrapeMarketIndicators(html);
    
    if (indicators.length === 0) {
      console.error('No market indicators found after scraping.');
      return NextResponse.json({ success: false, error: 'No market indicators found' }, { status: 404 });
    }

    // Redis에 데이터 저장
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