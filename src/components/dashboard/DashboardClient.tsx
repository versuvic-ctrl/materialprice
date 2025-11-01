// src/components/dashboard/DashboardClient.tsx
/**
 * DashboardClient.tsx - 대시보드 메인 통계 카드 컴포넌트
 */
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from '@tanstack/react-query';
import MarketIndicatorsSummary from "./MarketIndicatorsSummary";
import { DASHBOARD_CHARTS_CONFIG, materialInfoMap } from '@/config/chartConfig'; // --- [수정] 중앙 설정 파일에서 가져옵니다.
import useMaterialStore from '@/store/materialStore';

// (인터페이스 및 타입 정의는 기존과 동일)
interface MaterialChangeData {
  name: string; // id
  displayName: string; // 원래 displayName
  monthlyChange: number | null;
}
interface CategorySummary {
  category: string;
  summary: string;
}
interface DashboardData {
  total_materials: number;
  total_categories: number;
  average_price: number;
}
interface DashboardClientProps {
  dashboardData: DashboardData | null;
}

// --- [수정] allMaterialSummaryNames는 여기서 생성합니다. ---
const allMaterialSummaryNames = Array.from(materialInfoMap.values()).map(info => info.summaryName);

// (getTrendInfo, generateCompactCategorySummary 함수는 기존과 동일)
const getTrendInfo = (change: number | null) => {
  if (change === null || isNaN(change) || Math.abs(change) < 1) {
    return { type: 'stable', text: '변동없음' };
  } else if (Math.abs(change) > 3) {
    return {
      type: change > 0 ? 'major-up' : 'major-down',
      icon: change > 0 ? '__SVG_ICON_UP__' : '__SVG_ICON_DOWN__',
      text: change > 0 ? '대폭 상승' : '대폭 하락'
    };
  } else {
    return {
      type: change > 0 ? 'minor-up' : 'minor-down',
      icon: change > 0 ? '__SVG_ICON_UP__' : '__SVG_ICON_DOWN__',
      text: change > 0 ? '소폭 상승' : '소폭 하락'
    };
  }
};
const generateCompactCategorySummary = (materials: MaterialChangeData[]): {
  trend: ReturnType<typeof getTrendInfo>,
  summary: string
} => {
    if (materials.length === 0) {
        return { trend: getTrendInfo(0), summary: '전월대비 데이터 없음' };
    }
    const increasingMaterials: MaterialChangeData[] = [];
    const decreasingMaterials: MaterialChangeData[] = [];
    let noChangeCount = 0;
    materials.forEach(material => {
        const change = material.monthlyChange;
        if (change === null || isNaN(change) || Math.abs(change) < 1) {
            noChangeCount++;
        } else if (change > 0) {
            increasingMaterials.push(material);
        } else {
            decreasingMaterials.push(material);
        }
    });
    increasingMaterials.sort((a, b) => (b.monthlyChange ?? 0) - (a.monthlyChange ?? 0));
    decreasingMaterials.sort((a, b) => (a.monthlyChange ?? 0) - (b.monthlyChange ?? 0));
    const displayMaterials = [...increasingMaterials, ...decreasingMaterials];
    const allChangedMaterials = [...increasingMaterials, ...decreasingMaterials];
    const maxChange = allChangedMaterials.length > 0
        ? allChangedMaterials.reduce((prev, current) =>
            Math.abs(prev.monthlyChange ?? 0) > Math.abs(current.monthlyChange ?? 0) ? prev : current
        ) : { monthlyChange: 0 };
    const trend = getTrendInfo(maxChange.monthlyChange ?? 0);
    let summary = '전월대비 ';
    const parts: string[] = [];
    if (displayMaterials.length > 0) {
        displayMaterials.forEach(material => {
            const change = material.monthlyChange ?? 0;
            const materialInfo = materialInfoMap.get(material.name);
            const materialNameForSummary = materialInfo ? materialInfo.summaryName : material.name;
            const trendInfo = getTrendInfo(change);
            parts.push(`${materialNameForSummary} ${change.toFixed(2)}% ${trendInfo.text} ${trendInfo.icon} `);
        });
    }
    if (noChangeCount > 0) {
        if (displayMaterials.length === 0) {
            parts.push('모든 자재 변동 없음');
        } else if (displayMaterials.length < 3) {
            parts.push('이외 자재는 변동없음');
        }
    }
    summary += parts.length > 0 ? parts.join(', ') : '모든 자재 변동 없음';
    return { trend, summary };
};


const DashboardClient: React.FC<DashboardClientProps> = ({ dashboardData }) => {
  const { startDate, endDate } = useMaterialStore();

  const categoryIcons = useMemo(() => ({
    '철금속': '🔩', '비철금속': '⚡', '플라스틱': '🧪', '테프론': '🧬', '전기자재': '⚡', '토건자재': '🏗️'
  }), []);

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['category-summary', startDate, endDate], 
    queryFn: async () => {
      console.log(`🚀 SUMMARY 데이터 페칭 시작 (종료일: ${endDate})`);
      const startTime = performance.now();
      
      const categoryPromises = DASHBOARD_CHARTS_CONFIG.map(async (categoryConfig) => {
        const category = categoryConfig.title.split('(')[0];
        const materials = categoryConfig.materials.map(m => m.id);

        try {
          const categoryStartTime = performance.now();
          
          const response = await fetch('/api/materials/prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ materials, startDate, endDate, interval: 'monthly' }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error(`❌ 카테고리 ${category} API 오류:`, errorData.error);
            return { category, summary: '전월대비 데이터 조회 실패', trend: getTrendInfo(0) };
          }
          const data = await response.json();
          const categoryData: MaterialChangeData[] = [];
          if (data && Array.isArray(data)) {
            for (const material of materials) {
              const materialData = data.filter((item: any) => item.specification === material);
              const sortedData = materialData.sort((a: any, b: any) => new Date(b.time_bucket).getTime() - new Date(a.time_bucket).getTime());
              let monthlyChange: number | null = null;
              if (sortedData.length >= 2) {
                const currentPrice = parseFloat(sortedData[0]?.average_price || '0');
                const previousPrice = parseFloat(sortedData[1]?.average_price || '0');
                if (previousPrice !== 0) {
                  monthlyChange = ((currentPrice - previousPrice) / previousPrice) * 100;
                  monthlyChange = Math.round(monthlyChange * 100) / 100;
                }
              }
              const materialInfo = materialInfoMap.get(material);
              categoryData.push({
                name: material,
                displayName: materialInfo ? materialInfo.displayName : material,
                monthlyChange
              });
            }
          }
          const { trend, summary } = generateCompactCategorySummary(categoryData);
          const categoryEndTime = performance.now();
          console.log(`✅ ${category} 처리 완료: ${(categoryEndTime - categoryStartTime).toFixed(2)}ms`);
          return { category, summary, trend };
        } catch (error) {
          console.error(`❌ 카테고리 ${category} 처리 중 오류:`, error);
          return { category, summary: '전월대비 데이터 조회 실패', trend: getTrendInfo(0) };
        }
      });
      
      const summaries = await Promise.all(categoryPromises);
      const endTime = performance.now();
      console.log(`🎯 전체 SUMMARY 데이터 페칭 완료: ${(endTime - startTime).toFixed(2)}ms`);
      return summaries;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  if (!dashboardData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {[...Array(3)].map((_, index) => (
          <Card key={index}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1"><CardTitle className="text-sm font-medium text-gray-800"><Skeleton className="h-4 w-20" /></CardTitle><Skeleton className="h-6 w-6 rounded" /></CardHeader><CardContent className="pt-1"><Skeleton className="h-8 w-16 mb-2" /><Skeleton className="h-3 w-24" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-20 gap-4 mb-4">
      <Card className="lg:col-span-15 min-h-[220px] bg-white shadow-sm border border-gray-100">
        <div className="h-full flex flex-col">
            <div className="px-3 sm:px-4 py-2 border-b border-gray-100"><div className="flex flex-row justify-between items-center gap-1 flex-nowrap"><h3 className="text-sm sm:text-base font-bold text-gray-900 flex-shrink-0">자재 가격 변동 SUMMARY</h3><span className="text-xs text-gray-500 flex-shrink-0">(전월비)</span></div></div>
          <div className="flex-1 px-3 sm:px-4 py-2 sm:py-3 overflow-hidden"><div className="h-full space-y-1">
          {summaryLoading ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3"><div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div><span className="text-sm text-gray-600">자재 가격 데이터 분석 중...</span></div>
              {DASHBOARD_CHARTS_CONFIG.map((categoryConfig, index) => (
                <div key={categoryConfig.title} className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-gray-200 animate-pulse flex items-center justify-center"><div className="w-3 h-3 bg-gray-300 rounded"></div></div><div className="flex-1"><Skeleton className="h-5 w-full" style={{ animationDelay: `${index * 100}ms` }} /></div></div>
              ))}
            </div>
          ) : (
            <div>
              {summaryData?.map((item, index) => {
                const renderSummary = (summary: string) => {
                  if (summary.includes('전월대비 모든 자재 변동 없음')) {
                    return (<span><span className="text-gray-800">전월대비 모든 자재 </span><span className="font-semibold text-green-600">변동 없음</span></span>);
                  }
                  if (summary.includes('모든 자재 변동 없음')) {
                    return <span className="font-semibold text-green-600">{summary}</span>;
                  }
                  const escapedNames = allMaterialSummaryNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                  const materialRegex = new RegExp(`(${escapedNames.join('|')})`);
                  const parts = summary.split(materialRegex).filter(Boolean);
                  return parts.map((part, partIndex) => {
                    if (allMaterialSummaryNames.includes(part)) {
                      const materialName = part;
                      const details = parts[partIndex + 1] || '';
                      const detailParts = details.trim().split(' ');
                      return (
                        <React.Fragment key={partIndex}>
                          <span className="font-bold text-gray-800">{materialName}</span>{' '}
                          {detailParts.map((detail, detailIndex) => {
                            if (detail.includes('%')) {
                              const colorClass = details.includes('상승') ? 'text-red-600' : details.includes('하락') ? 'text-blue-600' : 'text-gray-600';
                              return <span key={detailIndex} className={`font-bold ${colorClass}`}>{detail} </span>;
                            }
                            if (['소폭', '대폭', '상승', '하락'].includes(detail)) {
                                const colorClass = details.includes('상승') ? 'text-red-600' : details.includes('하락') ? 'text-blue-600' : 'text-gray-800';
                                return <span key={detailIndex} className={`font-semibold ${colorClass}`}>{detail} </span>;
                            }
                            if (detail === '__SVG_ICON_UP__') return <img key={detailIndex} src="/icons/1f4c8.svg" alt="상승" className="inline-block w-4 h-4 ml-1" />;
                            if (detail === '__SVG_ICON_DOWN__') return <img key={detailIndex} src="/icons/1f4c9.svg" alt="하락" className="inline-block w-4 h-4 ml-1" />;
                            return `${detail} `;
                          })}
                        </React.Fragment>
                      );
                    } 
                    else if (partIndex > 0 && allMaterialSummaryNames.includes(parts[partIndex - 1])) return null;
                    else return <span key={partIndex}>{part}</span>;
                  });
                };
                const getCategoryEmoji = (category: string): string => {
                  const emojiMap: { [key: string]: string } = { '철금속': '🔩', '비철금속': '⛏️', '플라스틱': '🧪', '테프론': '🔬', '전기자재': '⚡', '토건자재': '🏗️' };
                  return emojiMap[category] || '📦';
                };
                return (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center py-1 leading-relaxed">
                    <div className="flex flex-row items-start space-x-1 w-full">
                      <span className="text-[13px] font-bold text-gray-900 whitespace-nowrap">{getCategoryEmoji(item.category)} {item.category}:</span>
                      <span className="text-[13px] flex-1">{renderSummary(item.summary)}</span>
                    </div>
                  </div>
                );
              })}
              {(!summaryData || summaryData.length === 0) && (<div className="text-gray-500 text-center py-6 text-sm">데이터를 불러오는 중입니다...</div>)}
            </div>
          )}
            </div></div>
        </div>
      </Card>
      <MarketIndicatorsSummary className="lg:col-span-5" />
    </div>
  );
};

export default DashboardClient;