/**
 * PriceTable.tsx - 자재 가격 정보 테이블 컴포넌트
 * 
 * 기능:
 * - 자재별 현재 가격, 전월비, 전년비 표시
 * - 가격 포맷팅 (100,000원 이상은 천원단위, 이하는 원단위)
 * - 변동률에 따른 색상 코딩 (상승: 빨간색, 하락: 파란색, 변동없음: 검은색)
 * - 차트와 동일한 폭으로 깔끔한 정렬
 * 
 * 연관 파일:
 * - src/components/dashboard/DashboardMiniChart.tsx (부모 컴포넌트)
 * 
 * 중요도: ⭐⭐ 중요 - 차트 보완 정보 제공
 */
'use client';

import React from 'react';

// 자재 가격 데이터 타입 정의
interface MaterialPriceData {
  name: string;           // 품목명 (간단 명료하게)
  currentPrice: number;   // 현재 가격
  unit: string;           // 단위 (kg, ton, m 등)
  monthlyChange: number;  // 전월비 (%)
  yearlyChange: number;   // 전년비 (%)
}

// 컴포넌트 Props 타입 정의
interface PriceTableProps {
  data: MaterialPriceData[];
  isLoading?: boolean;
}

// 가격 포맷팅 함수 - 단위 변환 적용
const formatPrice = (price: number): string => {
  // 이미 kg 단위로 변환된 가격을 사용
  return `${Math.round(price).toLocaleString('ko-KR')}원`;
};

// 변동률 포맷팅 및 색상 결정 함수
const formatChange = (change: number): { text: string; color: string } => {
  if (change === 0) {
    return { text: '변동없음', color: 'text-gray-900' };
  } else if (change > 0) {
    return { text: `+${change.toFixed(2)}%`, color: 'text-red-500' };
  } else {
    return { text: `${change.toFixed(2)}%`, color: 'text-blue-500' };
  }
};

const PriceTable: React.FC<PriceTableProps> = ({ data, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="w-full mt-2">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-2"></div>
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-6 bg-gray-100 rounded mb-1"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full mt-2 text-center text-sm text-gray-500 py-4">
        표시할 가격 정보가 없습니다.
      </div>
    );
  }

  return (
    <div className="w-full mt-2">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {/* 테이블 헤더 */}
        <div className="grid grid-cols-5 gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
          <div className="text-xs font-medium text-gray-700">품목</div>
          <div className="text-xs font-medium text-gray-700 text-right">가격</div>
          <div className="text-xs font-medium text-gray-700 text-center">단위</div>
          <div className="text-xs font-medium text-gray-700 text-right">전월비</div>
          <div className="text-xs font-medium text-gray-700 text-right">전년비</div>
        </div>
        
        {/* 테이블 바디 */}
        <div className="divide-y divide-gray-100">
          {data.map((item, index) => {
            const monthlyChangeFormat = formatChange(item.monthlyChange);
            const yearlyChangeFormat = formatChange(item.yearlyChange);
            
            return (
              <div key={index} className="grid grid-cols-5 gap-2 px-3 py-2 hover:bg-gray-50 transition-colors">
                {/* 품목명 */}
                <div className="text-xs text-gray-900 truncate" title={item.name}>
                  {item.name}
                </div>
                
                {/* 가격 */}
                <div className="text-xs text-gray-900 text-right font-medium">
                  {formatPrice(item.currentPrice)}
                </div>
                
                {/* 단위 */}
                <div className="text-xs text-gray-900 text-center">
                  kg
                </div>
                
                {/* 전월비 */}
                <div className={`text-xs text-right font-medium ${monthlyChangeFormat.color}`}>
                  {monthlyChangeFormat.text}
                </div>
                
                {/* 전년비 */}
                <div className={`text-xs text-right font-medium ${yearlyChangeFormat.color}`}>
                  {yearlyChangeFormat.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PriceTable;
export type { MaterialPriceData };