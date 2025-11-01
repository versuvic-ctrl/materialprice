'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '@/components/ui/card';

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

    const jsonData: MarketIndicator[] = await response.json();
    console.log('Parsed data from API:', jsonData);
    
    return jsonData || [];
  } catch (error) {
    console.error('Error fetching market indicators from API:', error);
    return []; // 에러 발생 시 빈 배열 반환
  }
}

// 포맷팅 함수들 (수정 없음)
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
  if (change > 0) return 'text-red-600';
  if (change < 0) return 'text-blue-600';
  return 'text-gray-600';
};

const getChangeIcon = (change: number): string => {
  if (change > 0) return '▲';
  if (change < 0) return '▼';
  return '─';
};

export default function MarketIndicatorsSummary({ className }: { className?: string }) {
  const [indicators, setIndicators] = useState<MarketIndicator[]>([]);
  const [isLoading, setIsLoading] = useState(true); // 로딩 상태 추가
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchIndicators = async () => {
    setIsLoading(true); // 데이터 요청 시작 시 로딩 상태로 설정
    try {
      const data = await getMarketIndicators();
      setIndicators(data);
    } catch (error) {
      console.error("Failed to fetch and set indicators:", error);
      setIndicators([]); // 에러 발생 시 데이터를 비워줌
    } finally {
      setIsLoading(false); // 요청 완료 후 (성공/실패 무관) 로딩 상태 해제
    }
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
    <Card className={`min-h-[220px] bg-white shadow-sm border border-gray-100 overflow-hidden ${className}`}>
      <div className="h-full flex flex-col">
        {/* 헤더 */}
        <CardHeader className="flex flex-row justify-between items-center space-y-0 pt-2 pb-2 px-3 sm:px-4 border-b border-gray-100">
          <h3 className="text-sm sm:text-base font-bold text-gray-900 flex-shrink-0">주요 시장지표 SUMMARY</h3>
          <span className="text-xs text-gray-500 flex-shrink-0">(전일비)</span>
        </CardHeader>

        {/* 지표 목록 (조건부 렌더링으로 수정) */}
        <div className="flex-1 px-3 sm:px-4 py-2 sm:py-3 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-[13px] text-gray-500">시장 지표 로딩 중...</p>
            </div>
          ) : indicators.length > 0 ? (
             <div className="h-full space-y-0.5">
                {indicators.map((indicator, index) => (
                  <div
                    key={`${indicator.name}-${index}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between py-0.5"
                  >
                  {/* 왼쪽: 카테고리와 항목명 */}
                  <div className="flex items-center space-x-1">
                    <span className="text-[13px] font-bold text-gray-900 whitespace-nowrap">
                      {indicator.category}
                    </span>
                    <span className="text-[13px] font-bold text-gray-800">
                      {indicator.name}
                    </span>
                  </div>

                  {/* 오른쪽: 가격과 변동 */}
                  <div className="flex items-center space-x-3 text-right flex-shrink-0">
                    <div className="text-right">
                      <span className="text-[13px] font-bold text-gray-900">
                        {formatValue(indicator.value, indicator.unit)}
                      </span>
                      <span className="text-[13px] text-gray-500 ml-1 font-medium">
                        {indicator.unit}
                      </span>
                    </div>
                    <div className={`text-[13px] font-bold ${getChangeColor(indicator.change)} flex items-center space-x-1 min-w-[50px] justify-end`}>
                      <span className="text-[10px]">{getChangeIcon(indicator.change)}</span>
                      <span>{formatChangeValue(indicator.change, indicator.unit)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-[13px] text-gray-500">데이터를 불러오지 못했습니다.</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}