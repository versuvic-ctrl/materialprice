// src/app/api/market-indicators/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server'; // Supabase client는 이제 사용되지 않지만, 다른 함수에서 쓸 수 있어 남겨둘 수 있습니다.
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

// 스크래핑 함수는 이전과 동일합니다 (수정 없음)
async function scrapeMarketIndicators(html: string): Promise<MarketIndicator[]> {
  const $ = load(html);
  const marketIndicators: MarketIndicator[] = [];

  const extractDataFromTable = (selector: string, category: string, unitMap: { [key: string]: string } = {}) => {
    $(selector).each((i, el) => {
      const name = $(el).find('th').text().trim();
      const valueText = $(el).find('td').eq(0).text().trim();
      const changeText = $(el).find('td').eq(1).text().trim().replace(/,/g, '');
      const changeDirection = $(el).find('td').eq(1).find('img').attr('alt');

      if (name && valueText) {
        const value = parseFloat(valueText.replace(/,/g, ''));
        let change = parseFloat(changeText);

        if (changeDirection === '하락') {
          change *= -1;
        }

        const unit = unitMap[name] || '';
        
        marketIndicators.push({
          name: name,
          value: isNaN(value) ? 0 : value,
          change: isNaN(change) ? 0 : change,
          changerate: 0, 
          category: category,
          unit: unit,
        });
      }
    });
  };

  extractDataFromTable('#exchangeList > li', '환율', {
    '미국 USD': '원',
    '일본 JPY (100엔)': '원',
    '유럽연합 EUR': '원',
    '중국 CNY': '원',
  });

  extractDataFromTable('#oilGoldList > li', '원자재', {
    '국제 금': '달러/Oz',
    '국내 금': '원/g',
    '휘발유': '원/L',
  });
  
  $('.tbl_exchange.market tbody tr').each((i, el) => {
    const name = $(el).find('th a span').text().trim();
    const valueText = $(el).find('td').eq(0).text().trim();
    const changeText = $(el).find('td').eq(1).text().trim();
    const changeDirection = $(el).find('td').eq(1).find('img').attr('alt');
    
    if (name && valueText) {
      const value = parseFloat(valueText.replace(/,/g, ''));
      let change = parseFloat(changeText);
      
      if (changeDirection === '하락') {
        change *= -1;
      }
      
      marketIndicators.push({
        name,
        value: isNaN(value) ? 0 : value,
        change: isNaN(change) ? 0 : change,
        changerate: 0,
        category: '금리',
        unit: '%',
      });
    }
  });

  console.log(`스크래핑 완료: ${marketIndicators.length}개 지표를 찾았습니다.`);
  return marketIndicators;
}

const CACHE_KEY = 'marketIndicators';
const CACHE_EXPIRATION_SECONDS = 86400; // 24시간 캐시 유지

// GET 함수는 이전과 동일합니다 (수정 없음)
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


// ==========================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ POST 함수를 대폭 수정했습니다 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// ==========================================================
export async function POST() {
  try {
    const response = await fetch('https://finance.naver.com/marketindex/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
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

    // --- Supabase 저장 로직 제거 ---

    // Redis에만 데이터 저장
    try {
      await redis.setex(CACHE_KEY, CACHE_EXPIRATION_SECONDS, JSON.stringify(indicators));
      console.log(`Redis cache updated successfully with ${indicators.length} items.`);
    } catch (redisSetError) {
      console.error('Error in Redis SETEX operation in POST:', redisSetError);
      // Redis 저장에 실패해도 치명적인 에러로 간주하지 않고, 다음 크롤링을 기다리도록 함
      throw redisSetError; // 또는 에러를 던져서 실패 응답을 보낼 수 있음
    }

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
// ==========================================================
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
// ==========================================================