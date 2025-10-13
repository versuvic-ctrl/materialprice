import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { load } from 'cheerio';
// import * as fs from 'fs';
// import * as path from 'path';

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

async function updateMarketIndicators(indicators: MarketIndicator[]) {
  try {
    const supabase = await createClient();
    
    // 기존 데이터 삭제
    await supabase.from('market_indicators').delete().neq('id', 0);

    // 새 데이터 삽입
    const { error } = await supabase
      .from('market_indicators')
      .insert(indicators);

    if (error) {
      throw error;
    }

    return { success: true, count: indicators.length };
  } catch (error) {
    console.error('Error updating market indicators:', error);
    throw error;
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    
    // 현재 저장된 시장지표 데이터 조회
    const { data, error } = await supabase
      .from('market_indicators')
      .select('*')
      .order('category', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      lastUpdated: data?.[0]?.updated_at || null
    });
  } catch (error) {
    console.error('Error fetching market indicators:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch market indicators' },
      { status: 500 }
    );
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

    // 데이터베이스 업데이트
    const result = await updateMarketIndicators(indicators);

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${result.count} market indicators`,
      data: indicators
    });
  } catch (error) {
    console.error('Error updating market indicators:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update market indicators' },
      { status: 500 }
    );
  }
}