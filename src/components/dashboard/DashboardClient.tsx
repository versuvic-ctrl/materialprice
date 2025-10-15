/**
 * DashboardClient.tsx - 대시보드 메인 통계 카드 컴포넌트
 * 
 * 기능:
 * - 자재 가격 변동 요약, 평균 가격 등 핵심 통계 표시
 * - 카테고리별 전월비 변동률 분석 및 요약 텍스트 제공
 * - 로딩 상태 시 스켈레톤 UI 제공
 * - 반응형 그리드 레이아웃으로 카드 배치
 * 
 * 연관 파일:
 * - src/app/page.tsx (메인 대시보드 페이지에서 사용)
 * - src/components/ui/card.tsx (카드 UI 컴포넌트)
 * - src/components/ui/skeleton.tsx (로딩 스켈레톤)
 * 
 * 중요도: ⭐⭐⭐ 필수 - 대시보드의 핵심 통계 표시
 * 
 * 데이터 소스: 서버 컴포넌트에서 props로 전달받음
 */
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from '@tanstack/react-query';
import MarketIndicatorsSummary from "./MarketIndicatorsSummary";

// 카테고리별 자재 구성 정보
const CATEGORY_MATERIALS = {
  '철금속': [
    'H형강 -  (소형)H200×B100×t₁5.5×t₂8㎜ 단중21.3㎏/m',
    '스테인리스열연강판 STS304 -  (HR) 3~6',
    '스테인리스냉연강판 STS316(2B) -  2.0, 31.92',
    '후판 -  6.0 ≤T ≤7.0, 2,438 ×6,096㎜',
    '고장력철근(하이바)(SD 400) -  D10㎜, 0.560',
    '고철(철) - 중량철 A '
  ],
  '비철금속': [
    '주석 -  원소기호 Sn, 순도 99.85%',
    '연괴 -  원소기호 Pb, 순도 99.97% 이상',
    '니켈 -  원소기호 Ni, 순도 99.9%',
    '알루미늄 -  원소기호 Al, 순도 99.8%',
    '규소 -  원소기호 Si, 중국산, 순도 Si(98.5% 이상) Fe(0.5% 이하)',
    '전기동 -  원소기호 Cu, 순도 99.99%'
  ],
  '플라스틱': [
    'PP -  (Copolymer)',
    'HDPE -  파이프용',
    '경질염화비닐관(수도용VP)-직관 - VP PN 16 호칭경100㎜, 외경114㎜, 두께6.7(최소)㎜, 중량13,636g/본',
    'FRP DUCT(원형) -  호칭경: 4″, 내경: 100㎜ - 파이프',
    '일반용PE하수관-유공관 -  규격100㎜, 외경114㎜, 두께5.5㎜, 중량1.79㎏/m'
  ],
  '테프론': [
    'UHP PVDF PIPE SDR21 - (1PC=5M) 110㎜',
    'ECTFE PIPE SDR21(1본=5m) -  110㎜'
  ],
  '전기자재': [
    'FW-CV케이블 -  0.6/1KV 3C 16㎟',
    'FW-CV케이블 -  6/10KV 3C 35㎟',
    'F-GV -  70㎟'
  ],
  '토건자재': [
    '보통포틀랜드시멘트 -  40㎏ 入',
    '레미콘 - 25 24, 120'
  ]
};

// 자재 가격 변동 데이터 타입
interface MaterialChangeData {
  name: string;
  displayName: string;
  monthlyChange: number | null;
}

// 카테고리 요약 데이터 타입
interface CategorySummary {
  category: string;
  summary: string;
}

// 대시보드 통계 데이터 타입 정의
interface DashboardData {
  total_materials: number;    // 총 자재 수
  total_categories: number;   // 총 카테고리 수
  average_price: number;      // 평균 가격
}

// 컴포넌트 props 타입 정의
interface DashboardClientProps {
  dashboardData: DashboardData | null;  // null일 경우 로딩 상태 표시
}

// 자재명을 간단한 표시명으로 변환하는 함수
const getDisplayName = (materialName: string): string => {
  const displayNameMap: { [key: string]: string } = {
    'H형강 -  (소형)H200×B100×t₁5.5×t₂8㎜ 단중21.3㎏/m': 'H형강',
    '스테인리스열연강판 STS304 -  (HR) 3~6': 'STS304',
    '스테인리스냉연강판 STS316(2B) -  2.0, 31.92': 'STS316',
    '후판 -  6.0 ≤T ≤7.0, 2,438 ×6,096㎜': 'SS275',
    '고장력철근(하이바)(SD 400) -  D10㎜, 0.560': '고장력철근',
    '고철(철) - 중량철 A ': '고철(중량철A)',
    '주석 -  원소기호 Sn, 순도 99.85%': '주석',
    '연괴 -  원소기호 Pb, 순도 99.97% 이상': '연괴',
    '니켈 -  원소기호 Ni, 순도 99.9%': '니켈',
    '알루미늄 -  원소기호 Al, 순도 99.8%': '알루미늄',
    '규소 -  원소기호 Si, 중국산, 순도 Si(98.5% 이상) Fe(0.5% 이하)': '규소',
    '전기동 -  원소기호 Cu, 순도 99.99%': '전기동',
    'PP -  (Copolymer)': 'PP',
    'HDPE -  파이프용': 'HDPE',
    '경질염화비닐관(수도용VP)-직관 - VP PN 16 호칭경100㎜, 외경114㎜, 두께6.7(최소)㎜, 중량13,636g/본': 'PVC관',
    'FRP DUCT(원형) -  호칭경: 4″, 내경: 100㎜ - 파이프': 'FRP관',
    '일반용PE하수관-유공관 -  규격100㎜, 외경114㎜, 두께5.5㎜, 중량1.79㎏/m': 'PE관',
    'UHP PVDF PIPE SDR21 - (1PC=5M) 110㎜': 'PVDF관',
    'ECTFE PIPE SDR21(1본=5m) -  110㎜': 'ECTFE관',
    'FW-CV케이블 -  0.6/1KV 3C 16㎟': '저압케이블',
    'FW-CV케이블 -  6/10KV 3C 35㎟': '고압케이블',
    'F-GV -  70㎟': '접지케이블',
    '보통포틀랜드시멘트 -  40㎏ 入': '시멘트',
    '레미콘 - 25 24, 120': '레미콘'
  };
  return displayNameMap[materialName] || materialName;
};

// Helper function to get trend info with color and icon
const getTrendInfo = (change: number) => {
  if (Math.abs(change) >= 5) {
    return {
      type: change > 0 ? 'major-up' : 'major-down',
      color: change > 0 ? 'text-red-600' : 'text-blue-600',
      bgColor: change > 0 ? 'bg-red-50' : 'bg-blue-50',
      icon: change > 0 ? '📈' : '📉',
      text: change > 0 ? '대폭 상승' : '대폭 하락'
    };
  } else if (Math.abs(change) >= 2) {
    return {
      type: change > 0 ? 'minor-up' : 'minor-down',
      color: change > 0 ? 'text-orange-600' : 'text-cyan-600',
      bgColor: change > 0 ? 'bg-orange-50' : 'bg-cyan-50',
      icon: change > 0 ? '↗️' : '↘️',
      text: change > 0 ? '소폭 상승' : '소폭 하락'
    };
  } else {
    return {
      type: 'stable',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      icon: '➖',
      text: '변동없음'
    };
  }
};

// Helper function to generate compact category summary
const generateCompactCategorySummary = (materials: MaterialChangeData[]): { 
  trend: ReturnType<typeof getTrendInfo>, 
  summary: string 
} => {
  if (materials.length === 0) {
    return {
      trend: getTrendInfo(0),
      summary: '전월대비 데이터 없음'
    };
  }

  // Separate materials by change type (2% 이상 변동만 표시)
  const changedMaterials: MaterialChangeData[] = [];
  let noChangeCount = 0;

  materials.forEach(material => {
    const change = material.monthlyChange;
    if (change === null || change === undefined || Math.abs(change) < 2) {
      noChangeCount++;
    } else {
      changedMaterials.push(material);
    }
  });

  // Sort by absolute change value (descending)
  changedMaterials.sort((a, b) => {
    const aChange = a.monthlyChange ?? 0;
    const bChange = b.monthlyChange ?? 0;
    return Math.abs(bChange) - Math.abs(aChange);
  });

  // Find the most significant change for trend determination
  const maxChange = changedMaterials.length > 0 ? changedMaterials[0] : { monthlyChange: 0 };
  const trend = getTrendInfo(maxChange.monthlyChange ?? 0);
  
  let summary = '전월대비 ';
  const parts: string[] = [];

  // Add all materials with 2% or more change
  if (changedMaterials.length > 0) {
    const materialParts: string[] = [];
    
    changedMaterials.forEach(material => {
      const change = material.monthlyChange;
      const materialName = getDisplayName(material.name);
      
      const direction = Math.abs(change ?? 0) >= 5 ? ((change ?? 0) > 0 ? '대폭 상승' : '대폭 하락') : ((change ?? 0) > 0 ? '소폭 상승' : '소폭 하락');
      const emoji = (change ?? 0) > 0 ? '📈' : '📉';
      
      materialParts.push(`${materialName} ${(change ?? 0).toFixed(2)}% ${direction} ${emoji}`);
    });
    
    parts.push(materialParts.join(', '));
  }

  // Add no change info only if there are no changed materials
  if (noChangeCount > 0 && parts.length === 0) {
    parts.push('모든 자재 변동 없음');
  }

  summary += parts.length > 0 ? parts.join(', ') : '모든 자재 변동 없음';

  return { trend, summary };
};



const DashboardClient: React.FC<DashboardClientProps> = ({ dashboardData }) => {
  // 카테고리별 아이콘 매핑 (메모이제이션)
  const categoryIcons = useMemo(() => ({
    '철금속': '🔩',
    '비철금속': '⚡',
    '플라스틱': '🧪',
    '테프론': '🧬',
    '전기자재': '⚡',
    '토건자재': '🏗️'
  }), []);

  // 카테고리별 가격 변동 데이터 조회 (병렬 처리 최적화)
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['category-summary'],
    queryFn: async () => {
      console.log('🚀 카테고리별 데이터 페칭 시작 (병렬 처리)');
      const startTime = performance.now();
      
      // 병렬 API 호출을 위한 Promise 배열 생성
      const categoryPromises = Object.entries(CATEGORY_MATERIALS).map(async ([category, materials]) => {
        try {
          const categoryStartTime = performance.now();
          
          const response = await fetch('/api/materials/prices', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              materials,
              startDate: '2023-01-01',
              endDate: '2025-12-31',
              interval: 'month',
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error(`❌ 카테고리 ${category} API 오류:`, errorData.error);
            return {
              category,
              summary: '전월대비 데이터 조회 실패',
              trend: getTrendInfo(0)
            };
          }

          const data = await response.json();
          const categoryData: MaterialChangeData[] = [];

          if (data && Array.isArray(data)) {
            for (const material of materials) {
              const materialData = data.filter((item: any) => item.specification === material);
              const sortedData = materialData.sort((a: any, b: any) => 
                new Date(b.time_bucket).getTime() - new Date(a.time_bucket).getTime()
              );
              
              let monthlyChange: number | null = null;
              if (sortedData.length >= 2) {
                const currentPrice = parseFloat(sortedData[0]?.average_price || '0');
                const previousPrice = parseFloat(sortedData[1]?.average_price || '0');
                if (previousPrice !== 0) {
                  monthlyChange = ((currentPrice - previousPrice) / previousPrice) * 100;
                }
              }

              categoryData.push({
                name: material,
                displayName: getDisplayName(material),
                monthlyChange
              });
            }
          }
          
          const { trend, summary } = generateCompactCategorySummary(categoryData);
          const categoryEndTime = performance.now();
          console.log(`✅ ${category} 처리 완료: ${(categoryEndTime - categoryStartTime).toFixed(2)}ms`);
          
          return {
            category,
            summary,
            trend
          };
        } catch (error) {
          console.error(`❌ 카테고리 ${category} 처리 중 오류:`, error);
          return {
            category,
            summary: '전월대비 데이터 조회 실패',
            trend: getTrendInfo(0)
          };
        }
      });
      
      // 모든 카테고리 병렬 처리
      const summaries = await Promise.all(categoryPromises);
      
      const endTime = performance.now();
      console.log(`🎯 전체 카테고리 데이터 페칭 완료: ${(endTime - startTime).toFixed(2)}ms`);
      
      return summaries;
    },
    staleTime: 5 * 60 * 1000, // 5분간 캐시
    gcTime: 10 * 60 * 1000, // 10분간 가비지 컬렉션 방지
  });

  // 데이터가 없을 때 스켈레톤 로딩 UI 표시
  if (!dashboardData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {[...Array(3)].map((_, index) => (
          <Card key={index} className="border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium text-gray-800">
                <Skeleton className="h-4 w-20" />
              </CardTitle>
              <Skeleton className="h-6 w-6 rounded" />
            </CardHeader>
            <CardContent className="pt-1">
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }



  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
      {/* 자재 가격 변동 SUMMARY */}
      <Card className="lg:col-span-2 min-h-[220px] bg-white shadow-sm border border-gray-100">
        <div className="h-full flex flex-col">
          {/* 헤더 */}
            <div className="px-3 sm:px-4 py-2 border-b border-gray-100">
              <div className="flex flex-row justify-between items-center gap-1">
                <h3 className="text-sm sm:text-base font-bold text-gray-900">자재 가격 변동 SUMMARY</h3>
                <span className="text-xs text-gray-500">(전월비)</span>
              </div>
            </div>
          
          {/* 내용 */}
          <div className="flex-1 px-3 sm:px-4 py-2 sm:py-3 overflow-hidden">
            <div className="h-full space-y-1">
          {summaryLoading ? (
            <div className="space-y-3">
              {/* 로딩 상태 표시 */}
              <div className="flex items-center gap-2 mb-3">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                <span className="text-sm text-gray-600">자재 가격 데이터 분석 중...</span>
              </div>
              
              {/* 카테고리별 스켈레톤 */}
              {Object.keys(CATEGORY_MATERIALS).map((category, index) => (
                <div key={category} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-gray-200 animate-pulse flex items-center justify-center">
                    <div className="w-3 h-3 bg-gray-300 rounded"></div>
                  </div>
                  <div className="flex-1">
                    <Skeleton className="h-5 w-full" style={{ animationDelay: `${index * 100}ms` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {summaryData?.map((item, index) => {
                // Parse the summary to highlight material names and percentages
                const renderSummary = (summary: string) => {
                  // Special case: if summary contains "전월대비 모든 자재 변동 없음", style it appropriately
                  if (summary.includes('전월대비 모든 자재 변동 없음')) {
                    const prefix = summary.replace('전월대비 모든 자재 변동 없음', '');
                    return (
                      <span>
                        <span className="text-gray-800">{prefix}전월대비 모든 자재 </span>
                        <span className="font-semibold text-green-600">변동 없음</span>
                      </span>
                    );
                  }

                  // Fallback for other "변동 없음" cases
                  if (summary.includes('모든 자재 변동 없음')) {
                    return (
                      <span className="font-semibold text-green-600">
                        {summary}
                      </span>
                    );
                  }

                  const parts = summary.split(' ');
                  return parts.map((part, partIndex) => {
                    // Check if it's a percentage
                    if (part.includes('%')) {
                      let colorClass = 'text-gray-600';
                      const contextAfter = parts.slice(partIndex, partIndex + 3).join(' ');
                      
                      if (contextAfter.includes('상승')) {
                        colorClass = 'text-red-600';
                      } else if (contextAfter.includes('하락')) {
                        colorClass = 'text-blue-600';
                      }
                      
                      return (
                        <span 
                          key={partIndex} 
                          className={`font-bold ${colorClass}`}
                        >
                          {part}{' '}
                        </span>
                      );
                    }
                    // Check if it's a material name (the word right before a percentage)
                    else if (partIndex < parts.length - 1 && parts[partIndex + 1].includes('%')) {
                      return (
                        <span 
                          key={partIndex} 
                          className={`font-bold text-gray-800`}
                        >
                          {part}{' '}
                        </span>
                      );
                    }
                    // Check if it's direction words
                    else if (['소폭', '대폭', '상승', '하락'].includes(part)) {
                      const context = parts.slice(partIndex > 0 ? partIndex -1 : 0, partIndex + 2).join(' ');
                      let colorClass = 'text-gray-800';
                      if (context.includes('상승')) {
                        colorClass = 'text-red-600';
                      } else if (context.includes('하락')) {
                        colorClass = 'text-blue-600';
                      }
                      
                      return (
                        <span 
                          key={partIndex} 
                          className={`font-semibold ${colorClass}`}
                        >
                          {part}{' '}
                        </span>
                      );
                    }
                    return `${part} `;
                  });
                };

                // 카테고리별 이모지 매핑
                const getCategoryEmoji = (category: string): string => {
                  const emojiMap: { [key: string]: string } = {
                    '철금속': '🔩',
                    '비철금속': '⛏️',
                    '플라스틱': '🧪',
                    '테프론': '🔬',
                    '전기자재': '⚡',
                    '토건자재': '🏗️'
                  };
                  return emojiMap[category] || '📦';
                };

                return (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center py-1 leading-relaxed">
                    <div className="flex flex-row items-start space-x-1 w-full">
                      <span className="text-xs sm:text-sm font-bold text-gray-900 whitespace-nowrap">
                      {getCategoryEmoji(item.category)} {item.category}:
                    </span>
                      <span className="text-xs sm:text-sm flex-1">
                        {renderSummary(item.summary)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {(!summaryData || summaryData.length === 0) && (
                <div className="text-gray-500 text-center py-6 text-sm">
                  데이터를 불러오는 중입니다...
                </div>
              )}
            </div>
          )}
            </div>
          </div>
        </div>
      </Card>

      {/* 시장 지표 */}
      <MarketIndicatorsSummary />
    </div>
  );
};

export default DashboardClient;