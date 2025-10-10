'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Card } from '@/components/ui/card';

interface MarketIndicator {
  id: number;
  category: string;
  name: string;
  value: number;
  unit: string;
  change: number;
  changerate: number; // Keep this as it's from Supabase, but won't be displayed directly as per MarketIndicators.tsx design
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function getMarketIndicators(): Promise<MarketIndicator[]> {
  console.log('Fetching market indicators...');
  const { data, error } = await supabase
    .from('market_indicators')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching market indicators:', error);
    return [];
  }
  
  console.log('Fetched data:', data);
  
  // Convert value to number
  const processedData = data.map(item => ({
    ...item,
    value: parseFloat(item.value) // Assuming value from Supabase is string and can be parsed to float
  }));
  
  console.log('Processed data:', processedData);
  return processedData;
}

// 네이버 스타일 포맷팅 함수들 (MarketIndicators.tsx에서 복사)
const formatValue = (value: number, unit: string): string => {
  if (unit === '%') {
    return value.toFixed(2);
  }
  return value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatChangeValue = (change: number, unit: string): string => {
  const formattedChange = Math.abs(change).toFixed(2);
  if (unit === '%') {
    return `${formattedChange}%`;
  }
  return formattedChange;
};

const getChangeColor = (change: number): string => {
  if (change > 0) return 'text-red-600'; // 네이버 상승 색상
  if (change < 0) return 'text-blue-600'; // 네이버 하락 색상
  return 'text-gray-600';
};

const getChangeIcon = (change: number): string => {
  if (change > 0) return '▲';
  if (change < 0) return '▼';
  return '─';
};

export default function MarketIndicatorsSummary() {
  const [indicators, setIndicators] = useState<MarketIndicator[]>([]);

  useEffect(() => {
    const fetchIndicators = async () => {
      const data = await getMarketIndicators();
      setIndicators(data);
    };
    fetchIndicators();
  }, []);

  return (
    <Card className="h-[220px] bg-white shadow-sm border border-gray-100 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* 헤더 */}
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-900">주요 시장지표 SUMMARY</h3>
            <span className="text-xs text-gray-500">(전일비)</span>
          </div>
        </div>

        {/* 지표 목록 */}
        <div className="flex-1 px-4 py-4 overflow-hidden">
          <div className="h-full space-y-0.5">
            {indicators.map((indicator) => (
              <div
                key={indicator.id}
                className="flex items-center justify-between py-0.5 leading-[0.8]"
              >
                {/* 왼쪽: 카테고리와 항목명 */}
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <span className="text-sm text-gray-600 font-medium whitespace-nowrap">
                    {indicator.category}
                  </span>
                  <span className="text-sm text-gray-800 font-semibold whitespace-nowrap">
                    {indicator.name}
                  </span>
                </div>

                {/* 오른쪽: 가격과 변동 */}
                <div className="flex items-center space-x-3 text-right flex-shrink-0">
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">
                      {formatValue(indicator.value, indicator.unit)}
                    </span>
                    <span className="text-xs text-gray-500 ml-1 font-medium">
                      {indicator.unit}
                    </span>
                  </div>
                  <div className={`text-xs font-bold ${getChangeColor(indicator.change)} flex items-center space-x-1 min-w-[50px] justify-end`}>
                    <span className="text-[10px]">{getChangeIcon(indicator.change)}</span>
                    <span>{formatChangeValue(indicator.change, indicator.unit)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}