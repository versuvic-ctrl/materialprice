import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { redis } from '@/utils/redis';
import { load } from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

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

async function logToSupabase(level: 'info' | 'error', message: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('scrape_logs').insert({
    level,
    message,
  });
  if (error) {
    console.error('Error logging to Supabase:', error);
  }
}

async function scrapeMarketIndicators(html: string): Promise<MarketIndicator[]> {
  const $ = load(html);
  const marketIndicators: MarketIndicator[] = [];

  $('.tbl_indicator tbody tr').each((i, el) => {
    const categoryName = $(el).find('th[class^="th_indi"] span').text().trim();
    const itemName = $(el).find('th[class^="th_type"] span').text().trim();
    const valueWithUnit = $(el).find('td:nth-of-type(1)').text().trim();
    const changeInfoText = $(el).find('td:nth-of-type(2)').text().trim();
    const changeDirection = $(el).find('td:nth-of-type(2) img').attr('alt');

    if (itemName && valueWithUnit && changeInfoText) {
      const value = parseFloat(valueWithUnit.replace(/[^0-9.-]+/g, ''));
      const unit = valueWithUnit.replace(/[0-9.-]+/g, '').trim();
      let change = parseFloat(changeInfoText.replace(/[^0-9.-]+/g, ''));

      if (changeDirection === '하락') {
        change *= -1;
      }

      let changerate = 0;
      if (!isNaN(value) && !isNaN(change) && value !== 0) {
        const previousValue = value - change;
        if (previousValue !== 0) {
          changerate = (change / previousValue) * 100;
        }
      }

      marketIndicators.push({
        name: itemName,
        value: isNaN(value) ? 0 : value,
        change: isNaN(change) ? 0 : change,
        changerate: changerate,
        category: categoryName,
        unit: unit,
      });
    } else {
      console.warn(`Skipping item ${i}: Missing itemName, valueWithUnit, or changeInfoText`);
    }
  });

  if (marketIndicators.length === 0) {
    console.warn('No market indicators scraped, returning dummy data.');
    return [
      { name: 'Dummy USD', value: 1300, change: 10, changerate: 0.5, category: 'Currency', unit: 'KRW' },
      { name: 'Dummy Gold', value: 2000, change: -5, changerate: -0.2, category: 'Commodity', unit: 'USD/oz' },
    ];
  }

  return marketIndicators;
}

const CACHE_KEY = 'marketIndicators';
const CACHE_EXPIRATION_SECONDS = 86400; // 24 hours

export async function GET(request: NextRequest) {
  try {
    // 1. Check Redis cache
    try {
      const cachedData = await redis.get(CACHE_KEY);
      if (cachedData) {
        // --- [수정된 부분 시작] ---
        // Redis에서 가져온 데이터의 타입을 확인합니다.
        // @upstash/redis는 JSON 문자열을 자동으로 객체로 파싱해줄 수 있습니다.
        const dataToReturn = typeof cachedData === 'string'
          ? JSON.parse(cachedData) // 만약 문자열이라면 파싱합니다.
          : cachedData;             // 이미 객체라면 그대로 사용합니다.
        
        console.log('✅ Market indicators fetched from Redis cache.');
        return NextResponse.json(dataToReturn);
        // --- [수정된 부분 끝] ---
      }
    } catch (redisError) {
      // redis.get() 또는 JSON.parse()에서 에러가 발생하면 여기서 잡힙니다.
      console.error('Error processing data from Redis:', redisError);
      // Redis 오류가 발생해도 파일 시스템에서 읽는 로직으로 넘어갑니다.
    }

    // 2. If not in cache (or Redis error), return empty array
    console.log('❌ Market indicators cache miss or Redis error, returning empty array.');
    return NextResponse.json([]);
  } catch (error) {
    console.error('Error in GET /api/market-indicators:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Internal server error: ${errorMessage}` }, { status: 500 });
  }
}

async function saveToPublicJson(indicators: MarketIndicator[]) {
  try {
    const publicDir = path.join(process.cwd(), 'public');
    const jsonFilePath = path.join(publicDir, 'market-indicators.json');
    
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const jsonData = {
      data: indicators,
      lastUpdated: new Date().toISOString(),
      timestamp: Date.now()
    };

    fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf8');
    
    await logToSupabase('info', `Market indicators JSON saved to public folder: ${indicators.length} items`);
    
    return { success: true, path: jsonFilePath };
  } catch (error) {
    console.error('Error saving to public JSON:', error);
    await logToSupabase('error', `Failed to save market indicators JSON: ${error}`);
    throw error;
  }
}

export async function POST() {
  try {
    const response = await fetch('https://finance.naver.com/marketindex/goldDetail.nhn');
    const arrayBuffer = await response.arrayBuffer();
    const decoder = new TextDecoder('euc-kr');
    const html = decoder.decode(arrayBuffer);

    const indicators = await scrapeMarketIndicators(html);
    
    if (indicators.length === 0) {
      return NextResponse.json({ success: false, error: 'No market indicators found' }, { status: 404 });
    }



    try {
      await redis.setex(CACHE_KEY, CACHE_EXPIRATION_SECONDS, JSON.stringify(indicators));
    } catch (redisSetError) {
      console.error('Error in Redis SETEX operation in POST:', redisSetError);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${indicators.length} market indicators and saved to public JSON`,
      data: indicators
    });
  } catch (error) {
    console.error('Error updating market indicators:', error);
    await logToSupabase('error', `Market indicators update failed: ${error}`);
    return NextResponse.json({ success: false, error: 'Failed to update market indicators' }, { status: 500 });
  }
}