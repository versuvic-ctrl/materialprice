'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';

interface MarketIndicator {
  category: string;
  name: string;
  value: number;
  unit: string;
  change: number;
  changerate: number;
}

async function getMarketIndicators(): Promise<MarketIndicator[]> {
  try {
    console.log('Fetching market indicators from API...');
    
    const response = await fetch('/api/market-indicators', {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const textData = await response.text(); // 먼저 텍스트로 받아서 로그
    console.log('Raw response text:', textData);

    const jsonData: MarketIndicator[] = JSON.parse(textData); // 텍스트를 JSON으로 파싱
    console.log('Parsed data from API:', jsonData);
    
    return jsonData || [];
  } catch (error) {
    console.error('Error fetching market indicators from API:', error);
    
    // 폴백: 빈 배열 반환
    return [];
  }
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

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchIndicators = async () => {
    const data = await getMarketIndicators();
    setIndicators(data);
    console.log('Indicators state after setIndicators:', data);
  };

  useEffect(() => {
    fetchIndicators();
  }, [refreshTrigger]);

  // 5분마다 자동 갱신
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 300000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="min-h-[220px] bg-white shadow-sm border border-gray-100 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* 헤더 */}
        <div className="px-3 sm:px-4 py-2 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
            <h3 className="text-sm sm:text-base font-bold text-gray-900">주요 시장지표 SUMMARY</h3>
            <span className="text-xs text-gray-500">(전일비)</span>
          </div>
        </div>

        {/* 지표 목록 */}
        <div className="flex-1 px-4 py-4 overflow-hidden">
          <div className="h-full space-y-0.5">
            {indicators.map((indicator, index) => (
              <div
                key={`${indicator.name}-${index}`}
                className="flex items-center justify-between py-0.5 leading-[0.8]"
              >
                {/* 왼쪽: 카테고리와 항목명 */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 font-medium flex-shrink-0">
                    {indicator.category}
                  </span>
                  <span className="text-sm text-gray-800 font-semibold flex-grow truncate">
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