import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { redis } from '@/utils/redis';
// import { fetchMarketIndicators } from '@/utils/redis'; // 이 줄을 주석 처리하거나 삭제합니다.
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

// const logDirectory = path.join(process.cwd(), 'logs');
// const logFilePath = path.join(logDirectory, 'market_indicators_scrape.log');

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

  // Select all rows within the main indicator table body
  $('.tbl_indicator tbody tr').each((i, el) => {
    const categoryName = $(el).find('th[class^="th_indi"] span').text().trim(); // Not used in the final MarketIndicator object, but good for debugging
    const itemName = $(el).find('th[class^="th_type"] span').text().trim();
    const valueWithUnit = $(el).find('td:nth-of-type(1)').text().trim();
    const changeInfoText = $(el).find('td:nth-of-type(2)').text().trim();
    const changeDirection = $(el).find('td:nth-of-type(2) img').attr('alt');

    if (itemName && valueWithUnit && changeInfoText) {
      const value = parseFloat(valueWithUnit.replace(/[^0-9.-]+/g, '')); // Remove non-numeric characters except dot and minus
      const unit = valueWithUnit.replace(/[0-9.-]+/g, '').trim(); // Extract unit by removing numeric characters and trimming
      let change = parseFloat(changeInfoText.replace(/[^0-9.-]+/g, '')); // Remove non-numeric characters except dot and minus

      // Apply change direction
      if (changeDirection === '하락') {
        change *= -1;
      }

      // Calculate changerate if possible, otherwise set to 0
      let changerate = 0;
      if (!isNaN(value) && !isNaN(change) && value !== 0) {
        // Assuming change is absolute, and we need to find the percentage change from the previous value
        // Previous value = Current value - Change
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


export async function GET() {
  const CACHE_KEY = 'marketIndicators';
  const CACHE_EXPIRATION_SECONDS = 3600; // 1 hour

  try {
    // 1. Check Redis cache
    let cachedData;
    try {
      cachedData = await redis.get(CACHE_KEY);
      if (cachedData) {
        return NextResponse.json(JSON.parse(cachedData as string));
      }
    } catch (redisGetError) {
      console.error('Error in Redis GET operation:', redisGetError);
      // Redis 오류가 발생해도 파일 시스템에서 읽는 로직은 계속 진행
    }

    // 2. If not in cache (or Redis error), read from public/market-indicators.json
    const jsonFilePath = path.join(process.cwd(), 'public', 'market-indicators.json');
    
    if (fs.existsSync(jsonFilePath)) {
      let fileContent;
      try {
        fileContent = fs.readFileSync(jsonFilePath, 'utf8');
      } catch (readFileError) {
        console.error('Error reading market-indicators.json:', readFileError);
        return NextResponse.json(
          { error: `Internal server error: Failed to read market-indicators.json: ${readFileError instanceof Error ? readFileError.message : String(readFileError)}` },
          { status: 500 }
        );
      }

      let jsonData;
      try {
        jsonData = JSON.parse(fileContent);
      } catch (parseJsonError) {
        console.error('Error parsing market-indicators.json content:', parseJsonError);
        return NextResponse.json(
          { error: `Internal server error: Failed to parse market-indicators.json: ${parseJsonError instanceof Error ? parseJsonError.message : String(parseJsonError)}` },
          { status: 500 }
        );
      }
      
      const indicators = jsonData.data; // Assuming the data is under a 'data' key
      if (!indicators) {
        console.error('Error: "data" key not found in market-indicators.json or is null/undefined.');
        return NextResponse.json(
          { error: 'Internal server error: Market indicators data is missing from JSON file.' },
          { status: 500 }
        );
      }

      // 3. Store in Redis cache (if not already cached and no Redis GET error)
      if (!cachedData) { // Only attempt to cache if not already served from cache
        try {
          await redis.setex(CACHE_KEY, CACHE_EXPIRATION_SECONDS, JSON.stringify(indicators));
        } catch (redisSetError) {
          console.error('Error in Redis SETEX operation:', redisSetError);
          // Redis 캐시 저장 실패는 500 오류를 발생시키지 않고 경고만 로깅
        }
      }
      return NextResponse.json(indicators);
    } else {
      console.warn('market-indicators.json not found, returning empty array.');
      return NextResponse.json([]);
    }
  } catch (error) {
    console.error('Error in GET /api/market-indicators (outer catch):', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Internal server error: ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error: An unknown error occurred' },
      { status: 500 }
    );
  }
}

async function saveToPublicJson(indicators: MarketIndicator[]) {
  try {
    const publicDir = path.join(process.cwd(), 'public');
    const jsonFilePath = path.join(publicDir, 'market-indicators.json');
    
    // public 디렉토리가 없으면 생성
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

    // 시장지표 데이터 크롤링
    const indicators = await scrapeMarketIndicators(html);
    
    if (indicators.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No market indicators found' },
        { status: 404 }
      );
    }

    // 1. public 폴더에 JSON 파일 저장 (CDN 캐싱용)
    await saveToPublicJson(indicators);

    // 2. 데이터베이스 업데이트 (백업용) - 이력 관리가 필요 없으므로 제거
    // await logToSupabase('info', `Market indicators updated successfully: ${indicators.length} items`);

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${indicators.length} market indicators and saved to public JSON`,
      data: indicators
    });
  } catch (error) {
    console.error('Error updating market indicators:', error);
    await logToSupabase('error', `Market indicators update failed: ${error}`);
    return NextResponse.json(
      { success: false, error: 'Failed to update market indicators' },
      { status: 500 }
    );
  }
}