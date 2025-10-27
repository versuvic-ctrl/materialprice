/**
 * materials/page.tsx - 자재 가격 조회 페이지
 * 
 * 🎯 기능:
 * - 4단계 계층형 자재 카테고리 선택 (대분류 > 중분류 > 소분류 > 규격)
 * - 동적 자재 가격 차트 (선택된 자재들의 가격 변동 추이)
 * - 자재 비교 및 물성 정보 표시
 * - 자재 계산기 (무게, 부피, 비용 계산)
 * - 시장 전망 및 가격 변동률 지표
 * 
 * 🔗 연관 파일:
 * - store/materialStore.ts: Zustand 전역 상태 관리
 * - components/materials/MaterialsChart.tsx: 자재 가격 차트
 * - lib/supabase.ts: Supabase 클라이언트 설정
 * 
 * ⭐ 중요도: ⭐⭐⭐ 필수 - 핵심 자재 조회 기능
 * 
 * 📊 데이터 소스: Supabase (동적) + 정적 물성 데이터
 * 🔄 상태 관리: Zustand (전역) + React Query (서버 상태)
 */
'use client';

import React, { memo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';

import useMaterialStore from '@/store/materialStore'; // [교체] Zustand 스토어 import
import dynamic from 'next/dynamic';

// 무거운 차트 컴포넌트를 동적 import로 최적화
const MaterialsChart = dynamic(() => import('@/components/materials/MaterialsChart'), {
  loading: () => (
    <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
      <div className="text-gray-500">차트 로딩 중...</div>
    </div>
  )
});

const MaterialsPriceTable = dynamic(() => import('@/components/materials/MaterialsPriceTable'), {
  loading: () => (
    <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg">
      <div className="text-gray-500">가격 테이블 로딩 중...</div>
    </div>
  )
});
// [제거] 탭 구조 제거로 인해 사용하지 않는 컴포넌트들 import 제거
// import MaterialPropertyComparison from '@/components/materials/MaterialPropertyComparison';
// import MakeItFromComparison from '@/components/materials/MakeItFromComparison';
// import type { MakeItFromDatabase } from '@/types/makeItFrom';



// useCategories 훅의 반환 타입 정의
interface UseCategoriesReturn {
  data: string[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

const useCategories = (
  level: 'major' | 'middle' | 'sub' | 'specification' | 'detail_spec', 
  filters: Record<string, any>
): UseCategoriesReturn => {
  
  const queryResult = useQuery<string[], Error>({
    queryKey: ['categories', level, filters],
    queryFn: async (): Promise<string[]> => {
      const response = await fetch(`/api/categories?level=${level}&filters=${JSON.stringify(filters)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${level} categories: ${response.statusText}`);
      }
      return response.json();
    },
    // enabled 옵션: 모든 레벨에서 쿼리를 실행하도록 변경하여 디버깅
    enabled: true,
    // 재시도 설정: 3번 재시도, 지수 백오프 적용
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // 1초, 2초, 4초 후 재시도
    // 스테일 타임 설정: 5분간 캐시된 데이터 사용
    staleTime: 5 * 60 * 1000,
    // 에러 발생 시에도 이전 데이터 유지
    placeholderData: []
  });
  
  return queryResult;
};

const MaterialsPage: React.FC = () => {
  const {
    selectedLevel1,              // 대분류 선택값
    selectedLevel2,              // 중분류 선택값
    selectedLevel3,              // 소분류 선택값
    selectedLevel4,              // 규격 선택값
    selectedLevel5,              // 상세규격 선택값
    setCategory,                 // 카테고리 선택 액션
    selectedMaterialsForChart,   // 차트에 표시할 자재 목록
    hiddenMaterials,             // 숨겨진 자재 Set
    addMaterialToChart,          // 차트에 자재 추가
    removeMaterialFromChart,     // 차트에서 자재 제거
    toggleMaterialVisibility,    // 자재 표시/숨김 토글
    clearAllMaterials,           // 모든 자재 제거
    resetAllMaterialState,       // resetAllMaterialState 액션 가져오기

  } = useMaterialStore();
  
  // 컴포넌트 언마운트 시 상태 초기화
  useEffect(() => {
    return () => {
      if (resetAllMaterialState) {
        resetAllMaterialState();
      }
    };
  }, [resetAllMaterialState]);

  // 테이블 행 수 계산 (숨겨진 자재 제외)
  const visibleMaterialsCount = selectedMaterialsForChart.filter(material => !hiddenMaterials.has(material)).length;

  // React Query를 통해 계층형 카테고리 데이터를 동적으로 조회
  const level1Categories = useCategories('major', {});
  
  const level2Categories = useCategories('middle', 
    React.useMemo(() => ({ major: selectedLevel1 }), [selectedLevel1])
  );
  
  const level3Categories = useCategories('sub', 
    React.useMemo(() => ({ major: selectedLevel1, middle: selectedLevel2 }), [selectedLevel1, selectedLevel2])
  );
  
  const level4Categories = useCategories('specification', 
    React.useMemo(() => ({ major: selectedLevel1, middle: selectedLevel2, sub: selectedLevel3 }), [selectedLevel1, selectedLevel2, selectedLevel3])
  );
  
  const level5Categories = useCategories('detail_spec', 
    React.useMemo(() => ({ major: selectedLevel1, middle: selectedLevel2, sub: selectedLevel3, specification: selectedLevel4 }), [selectedLevel1, selectedLevel2, selectedLevel3, selectedLevel4])
  );

  // 상세규격이 하나뿐일 경우 4레벨 규격을 차트에 추가 (5레벨 표시 안함)
  // 5레벨이 2개 이상일 때는 4레벨을 자동으로 차트에 추가하지 않음
  useEffect(() => {
    if (selectedLevel4 && !level5Categories.isLoading && level5Categories.data) {
      if (level5Categories.data.length === 1) {
        // 5레벨이 하나만 있으면 4레벨 규격만 차트에 추가
        addMaterialToChart(selectedLevel4);
      } else if (level5Categories.data.length === 0) {
        // 5레벨이 없으면 4레벨 규격을 차트에 추가
        addMaterialToChart(selectedLevel4);
      }
      // 5레벨이 2개 이상일 때는 4레벨을 자동으로 추가하지 않음 (사용자가 5레벨을 직접 선택해야 함)
    }
  }, [selectedLevel1, selectedLevel2, selectedLevel3, selectedLevel4, level5Categories.data, level5Categories.isLoading, addMaterialToChart]);

  // 상세규격이 선택되면 자동으로 차트에 추가
  useEffect(() => {
    if (selectedLevel5 && !selectedLevel5.includes('가①격')) {
      addMaterialToChart(selectedLevel5);
    }
  }, [selectedLevel1, selectedLevel2, selectedLevel3, selectedLevel4, selectedLevel5, addMaterialToChart]);

  // [제거] MakeItFrom 데이터 로드 - 탭 구조 제거로 인해 불필요

  // 상태 관리는 Zustand로, 서버 상태는 React Query로 처리하여 컴포넌트 로직 단순화

  return (
    <>
      <div className="space-y-2">
        {/* === 이 아래부터는 기존 UI 구조를 그대로 유지합니다 === */}

        {/* 가격 변동률 지표 (이 부분은 추후 동적 데이터로 연결 가능) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* ... 다른 지표 카드들 ... */}
        </div>

        {/* 자재가격 상세 페이지 - 탭 제거하고 바로 표시 */}
        <div className="mb-4">
          {/* 가격 변동률 지표 (이 부분은 추후 동적 데이터로 연결 가능) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* ... 다른 지표 카드들 ... */}
          </div>

          {/* [수정] 조회 조건: 컴팩트한 디자인 */}
              <Card className="border border-gray-200">
                <CardContent className="p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-2">
                      <Select value={selectedLevel1} onValueChange={(v) => setCategory(1, v)}>
                        <SelectTrigger className="h-7 sm:w-auto text-custom-xs">
                          <SelectValue placeholder="대분류" />
                        </SelectTrigger>
                        <SelectContent>
                          {level1Categories.isLoading && <SelectItem value="loading" disabled>로딩 중...</SelectItem>}
                          {level1Categories.data?.map((cat: string, index: number) => <SelectItem key={`level1-${cat}-${index}`} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      <Select value={selectedLevel2} onValueChange={(v) => setCategory(2, v)} disabled={!selectedLevel1 || level2Categories.isLoading}>
                        <SelectTrigger className="h-7 sm:w-auto text-custom-xs">
                          <SelectValue placeholder="중분류" />
                        </SelectTrigger>
                        <SelectContent>
                          {level2Categories.isLoading && <SelectItem value="loading" disabled>로딩 중...</SelectItem>}
                          {level2Categories.data?.map((cat: string, index: number) => <SelectItem key={`level2-${cat}-${index}`} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      <Select value={selectedLevel3} onValueChange={(v) => setCategory(3, v)} disabled={!selectedLevel2}>
                        <SelectTrigger className="h-7 sm:w-auto text-custom-xs">
                          <SelectValue placeholder="소분류" />
                        </SelectTrigger>
                        <SelectContent>
                          {level3Categories.isLoading && <SelectItem value="loading" disabled>로딩 중...</SelectItem>}
                          {level3Categories.data?.map((cat: string, index: number) => <SelectItem key={`level3-${cat}-${index}`} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      <Select value={selectedLevel4} onValueChange={(v) => setCategory(4, v)} disabled={!selectedLevel3 || level4Categories.isLoading}>
                        <SelectTrigger className="h-7 sm:w-auto text-custom-xs">
                          <SelectValue placeholder="규격" />
                        </SelectTrigger>
                        <SelectContent>
                          {level4Categories.isLoading && <SelectItem value="loading" disabled>로딩 중...</SelectItem>}
                          {level4Categories.data?.map((cat: string, index: number) => <SelectItem key={`level4-${cat}-${index}`} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      {/* 5번째 상세규격 드롭다운 - 조건부 렌더링 */}
                      {selectedLevel4 && level5Categories.data && Array.isArray(level5Categories.data) && level5Categories.data.length > 1 && (
                        <Select value={selectedLevel5} onValueChange={(v) => setCategory(5, v)} disabled={!selectedLevel4 || level5Categories.isLoading}>
                        <SelectTrigger className="h-7 sm:w-auto text-custom-xs">
                            <SelectValue placeholder="상세규격" />
                          </SelectTrigger>
                          <SelectContent>
                            {level5Categories.isLoading && <SelectItem value="loading" disabled>로딩 중...</SelectItem>}
                            {level5Categories.data?.map((cat: string, index: number) => <SelectItem key={`level5-${cat}-${index}`} value={cat}>{cat}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    
                    {/* 자재를 차트에 추가하는 버튼 */}
                    {/* 이 부분은 제거됩니다. */}
                  </div>
                </CardContent>
              </Card>

              {/* [수정] 선택된 자재 목록: 컴팩트하고 세련된 디자인 */}
              {selectedMaterialsForChart.length > 0 && (
                <Card className="border border-gray-200 mt-4">
                  <CardHeader className="py-1.5 px-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-xs font-medium text-gray-600">
                        비교할 자재를 선택해주세요 ({selectedMaterialsForChart.length}개)
                      </CardTitle>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={clearAllMaterials} 
                        className="h-6 px-2 text-xs border-gray-300 hover:bg-gray-50"
                      >
                        전체 제거
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div className="flex flex-wrap gap-1.5">
                      {selectedMaterialsForChart.map((material) => (
                        <div key={material} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-md border border-gray-200">
                          {/* 세련된 토글 스위치 */}
                          <button
                            title={`Toggle visibility of ${material}`}
                            aria-label={`Toggle visibility of ${material}`}
                            onClick={() => toggleMaterialVisibility(material)}
                            className={`relative inline-flex h-3 w-6 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                              !hiddenMaterials.has(material) ? 'bg-blue-500' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-2 w-2 transform rounded-full bg-white transition-transform duration-200 ${
                                !hiddenMaterials.has(material) ? 'translate-x-3.5' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                          <Label className="text-xs font-medium text-gray-700 cursor-pointer max-w-[200px] truncate" title={material}>
                            {material}
                          </Label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => removeMaterialFromChart(material)} 
                            className="h-4 w-4 p-0 hover:bg-red-100 hover:text-red-600 text-gray-400"
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

          {/* [교체] 차트 영역: 기존 DashboardCharts를 MaterialsChart로 교체 */}
          <div className="flex flex-col gap-2 mt-4">
            <div className="w-full">
              <MaterialsChart tableRowCount={visibleMaterialsCount} />
            </div>
            {/* [추가] 자재 가격 테이블 */}
            <div className="w-full">
              <MaterialsPriceTable selectedMaterials={selectedMaterialsForChart} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default memo(MaterialsPage);