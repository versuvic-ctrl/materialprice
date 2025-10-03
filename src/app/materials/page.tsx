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

import React, { memo } from 'react';
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
import Layout from '@/components/layout/Layout';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client'; // [수정]
import useMaterialStore from '@/store/materialStore'; // [교체] Zustand 스토어 import
import MaterialsChart from '@/components/materials/MaterialsChart'; // [교체] 새로운 차트 컴포넌트 import
import MaterialsPriceTable from '@/components/materials/MaterialsPriceTable'; // [추가] 자재 가격 테이블 컴포넌트 import
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // [추가] Tabs 컴포넌트 import

const supabase = createClient(); // [수정]

// 한글 자음 순서로 배열을 정렬하는 유틸리티 함수
// 카테고리 목록을 사용자가 찾기 쉽도록 가나다 순으로 정렬
const sortKorean = (arr: string[]) => {
  return arr.sort((a, b) => {
    return a.localeCompare(b, 'ko-KR', { 
      numeric: true, 
      sensitivity: 'base' 
    });
  });
};

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
    queryFn: async () => {
      
      // 타임아웃과 함께 Supabase RPC 함수 호출
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 15000); // 15초 타임아웃
      });
      
      const rpcPromise = supabase.rpc('get_distinct_categories', {
        p_level: level,
        p_filters: filters
      });
      
      try {
        const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as any;

        if (error) {
          throw new Error(`Failed to fetch ${level} categories: ${error.message || 'Unknown error'}`);
        }
        
        // 데이터 처리 및 한글 자음 순서로 정렬하여 반환
        let categories: string[] = [];
        if (Array.isArray(data)) {
          // RPC 함수가 다양한 형태로 반환하는 경우 처리
          categories = data.map((item: any) => {
            if (typeof item === 'string') {
              return item;
            } else if (item && typeof item.category === 'string') {
              // {category: "값"} 형태 처리 (우선순위 높임)
              return item.category;
            } else if (item && typeof item.get_distinct_categories === 'string') {
              return item.get_distinct_categories;
            } else if (item && typeof item.name === 'string') {
              return item.name;
            } else if (item && typeof item[level] === 'string') {
              return item[level];
            }
            return '';
          }).filter(cat => cat !== '');
        }
        
        return sortKorean(categories);
      } catch (err) {
        // 에러를 throw하여 React Query의 재시도 메커니즘 활용
        throw err;
      }
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
  } = useMaterialStore();

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

  // 상태 관리는 Zustand로, 서버 상태는 React Query로 처리하여 컴포넌트 로직 단순화

  return (
    <Layout title="자재가격 상세">
      <div className="space-y-6">
        {/* === 이 아래부터는 기존 UI 구조를 그대로 유지합니다 === */}

        {/* 가격 변동률 지표 (이 부분은 추후 동적 데이터로 연결 가능) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* ... 다른 지표 카드들 ... */}
        </div>

        <Tabs defaultValue="material-price-detail" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="material-price-detail">자재가격 상세</TabsTrigger>
            <TabsTrigger value="material-comparison-detail">재질비교 상세</TabsTrigger>
          </TabsList>
          <TabsContent value="material-price-detail">
            <div className="space-y-6">
              {/* 가격 변동률 지표 (이 부분은 추후 동적 데이터로 연결 가능) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* ... 다른 지표 카드들 ... */}
              </div>

              {/* [수정] 조회 조건: 컴팩트한 디자인 */}
              <Card className="border border-gray-200">
                <CardContent className="p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Select value={selectedLevel1} onValueChange={(v) => setCategory(1, v)}>
                        <SelectTrigger className="h-8 min-w-[100px] text-sm">
                          <SelectValue placeholder="대분류" />
                        </SelectTrigger>
                        <SelectContent>
                          {level1Categories.isLoading && <SelectItem value="loading" disabled>로딩 중...</SelectItem>}
                          {level1Categories.data?.map((cat: string, index: number) => <SelectItem key={`level1-${cat}-${index}`} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      <Select value={selectedLevel2} onValueChange={(v) => setCategory(2, v)} disabled={!selectedLevel1 || level2Categories.isLoading}>
                        <SelectTrigger className="h-8 min-w-[100px] text-sm">
                          <SelectValue placeholder="중분류" />
                        </SelectTrigger>
                        <SelectContent>
                          {level2Categories.isLoading && <SelectItem value="loading" disabled>로딩 중...</SelectItem>}
                          {level2Categories.data?.map((cat: string, index: number) => <SelectItem key={`level2-${cat}-${index}`} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      <Select value={selectedLevel3} onValueChange={(v) => setCategory(3, v)} disabled={!selectedLevel2 || level3Categories.isLoading}>
                        <SelectTrigger className="h-8 min-w-[100px] text-sm">
                          <SelectValue placeholder="소분류" />
                        </SelectTrigger>
                        <SelectContent>
                          {level3Categories.isLoading && <SelectItem value="loading" disabled>로딩 중...</SelectItem>}
                          {level3Categories.data?.map((cat: string, index: number) => <SelectItem key={`level3-${cat}-${index}`} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      <Select value={selectedLevel4} onValueChange={(v) => setCategory(4, v)} disabled={!selectedLevel3 || level4Categories.isLoading}>
                        <SelectTrigger className="h-8 min-w-[100px] text-sm">
                          <SelectValue placeholder="규격" />
                        </SelectTrigger>
                        <SelectContent>
                          {level4Categories.isLoading && <SelectItem value="loading" disabled>로딩 중...</SelectItem>}
                          {level4Categories.data?.map((cat: string, index: number) => <SelectItem key={`level4-${cat}-${index}`} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      {/* 5번째 상세규격 드롭다운 - 조건부 렌더링 */}
                      {selectedLevel4 && level5Categories.data && Array.isArray(level5Categories.data) && level5Categories.data.length > 0 && (
                        <Select value={selectedLevel5} onValueChange={(v) => setCategory(5, v)} disabled={!selectedLevel4 || level5Categories.isLoading}>
                          <SelectTrigger className="h-8 min-w-[100px] text-sm">
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
                    {selectedLevel5 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <Button 
                          onClick={() => {
                            const materialName = `${selectedLevel1} > ${selectedLevel2} > ${selectedLevel3} > ${selectedLevel4} > ${selectedLevel5}`;
                            addMaterialToChart(materialName);
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={!selectedLevel5}
                        >
                          차트에 추가
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* [수정] 선택된 자재 목록: 컴팩트하고 세련된 디자인 */}
              {selectedMaterialsForChart.length > 0 && (
                <Card className="border border-gray-200">
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
              <MaterialsChart />

              {/* [추가] 자재 가격 테이블 */}
              <MaterialsPriceTable selectedMaterials={selectedMaterialsForChart} />
            </div>
          </TabsContent>
          <TabsContent value="material-comparison-detail">
            {/* 재질비교 상세 페이지 내용이 들어갈 곳 */}
            <div className="p-4 text-center text-gray-500">
              재질비교 상세 페이지가 여기에 표시됩니다.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default memo(MaterialsPage);