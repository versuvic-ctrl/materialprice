'use client';

import { Card } from '@/components/ui/card';

// 네이버 주요 시장지표와 정확히 일치하는 데이터 구조
interface MarketIndicatorData {
  category: string;
  name: string;
  value: number;
  change: number;
  unit: string;
}

export default function MarketIndicators() {

  // 네이버 이미지와 정확히 일치하는 고정 데이터
  const marketData: MarketIndicatorData[] = [
    {
      category: '환율',
      name: '미국USD',
      value: 1408.20,
      change: 4.70,
      unit: '원'
    },
    {
      category: '금시세',
      name: '국제 금',
      value: 3908.90,
      change: 40.80,
      unit: '달러'
    },
    {
      category: '유가',
      name: '두바이유',
      value: 64.74,
      change: 0.70,
      unit: '달러'
    },
    {
      category: '금리',
      name: 'CD(91일)',
      value: 2.55,
      change: 0.01,
      unit: '%'
    },
    {
      category: '원자재',
      name: '구리',
      value: 10537.00,
      change: 82.00,
      unit: '달러'
    }
  ];

  // 네이버 스타일 포맷팅 함수들
  const formatValue = (value: number, unit: string): string => {
    if (unit === '%') {
      return value.toFixed(2);
    }
    return value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatChangeValue = (change: number): string => {
    return Math.abs(change).toFixed(2);
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

  return (
    <Card className="h-[220px] bg-white shadow-sm border border-gray-100 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* 헤더 */}
        <div className="px-4 py-2 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">주요 시장지표 SUMMARY</h3>
        </div>

        {/* 지표 목록 */}
        <div className="flex-1 px-4 py-4 overflow-hidden">
          <div className="h-full space-y-0.5">
            {marketData.map((item, index) => (
              <div 
                key={index}
                className="flex items-center justify-between py-0.5 leading-[0.8]"
              >
                {/* 왼쪽: 카테고리와 항목명 */}
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <span className="text-sm text-gray-600 font-medium whitespace-nowrap">
                    {item.category}
                  </span>
                  <span className="text-sm text-gray-800 font-semibold whitespace-nowrap">
                    {item.name}
                  </span>
                </div>

                {/* 오른쪽: 가격과 변동 */}
                <div className="flex items-center space-x-3 text-right flex-shrink-0">
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">
                      {formatValue(item.value, item.unit)}
                    </span>
                    <span className="text-xs text-gray-500 ml-1 font-medium">
                      {item.unit}
                    </span>
                  </div>
                  <div className={`text-xs font-bold ${getChangeColor(item.change)} flex items-center space-x-1 min-w-[50px] justify-end`}>
                    <span className="text-[10px]">{getChangeIcon(item.change)}</span>
                    <span>{formatChangeValue(item.change)}</span>
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