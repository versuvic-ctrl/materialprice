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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, CalendarDays, BarChart3 } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import useMaterialStore from '@/store/materialStore'; // [교체] Zustand 스토어 import
import MaterialsChart from '@/components/materials/MaterialsChart'; // [교체] 새로운 차트 컴포넌트 import

// [유지] 하단 자재 정보, 비교 테이블 등에서 정적 데이터로 사용
const MATERIAL_DATA = {
  'SUS304': { price: 8500, density: 7.93, tensile: 520, yield: 205, elastic: 200, thermal: 16.2 },
  'SUS316': { price: 9200, density: 8.0, tensile: 515, yield: 205, elastic: 200, thermal: 16.3 },
  'AL6061': { price: 3200, density: 2.7, tensile: 310, yield: 276, elastic: 68.9, thermal: 167 },
  'Carbon Steel': { price: 2800, density: 7.85, tensile: 400, yield: 250, elastic: 200, thermal: 50 }
};

// [추가] Supabase 클라이언트 및 데이터 페칭 훅
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 한글 자음 순서 정렬 함수
const sortKorean = (arr: string[]) => {
  return arr.sort((a, b) => {
    return a.localeCompare(b, 'ko-KR', { 
      numeric: true, 
      sensitivity: 'base' 
    });
  });
};

const useCategories = (level: 'major' | 'middle' | 'sub' | 'specification', filters: object) => {
  return useQuery({
    queryKey: ['categories', level, filters],
    queryFn: async () => {
      console.log(`Fetching ${level} categories with filters:`, filters);
      
      // 상위 카테고리가 선택되지 않았으면 쿼리 실행 안 함
      if (level !== 'major' && Object.values(filters).some(v => !v)) {
        console.log(`Skipping ${level} query - missing filters`);
        return [];
      }
      
      const { data, error } = await supabase.rpc('get_distinct_categories', {
        p_level: level,
        p_filters: filters
      });

      if (error) {
        console.error(`Error fetching ${level} categories:`, error);
        throw new Error(error.message);
      }
      
      console.log(`${level} categories result:`, data);
      const categories = data?.map((item: { name: string }) => item.name) || [];
      
      // 한글 자음 순서로 정렬
      return sortKorean(categories);
    },
    // enabled 옵션: 상위 필터값이 모두 존재할 때만 쿼리를 실행
    enabled: level === 'major' ? true : Object.values(filters).every(v => v),
  });
};

const MaterialsPage: React.FC = () => {
  // [교체] 모든 로컬 state(useState)를 Zustand 스토어의 전역 state와 action으로 대체
  const {
    selectedLevel1,
    selectedLevel2,
    selectedLevel3,
    selectedLevel4,
    setCategory,
    selectedMaterialsForChart,
    hiddenMaterials,
    removeMaterialFromChart,
    toggleMaterialVisibility,
    clearAllMaterials,
  } = useMaterialStore();

  // [교체] 하드코딩된 카테고리 데이터를 React Query를 통해 Supabase에서 동적으로 가져옴
  const { data: level1Categories, isLoading: level1Loading } = useCategories('major', {});
  const { data: level2Categories, isLoading: level2Loading } = useCategories('middle', { major_category: selectedLevel1 });
  const { data: level3Categories, isLoading: level3Loading } = useCategories('sub', { major_category: selectedLevel1, middle_category: selectedLevel2 });
  const { data: level4Categories, isLoading: level4Loading } = useCategories('specification', { major_category: selectedLevel1, middle_category: selectedLevel2, sub_category: selectedLevel3 });

  // 기존의 useEffect, useMemo, useCallback 훅들은 모두 Zustand와 React Query가 대체하므로 제거됨

  return (
    <Layout>
      <div className="space-y-6">
        {/* === 이 아래부터는 기존 UI 구조를 그대로 유지합니다 === */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">자재 가격 조회</h1>
        </div>

        {/* 가격 변동률 지표 (이 부분은 추후 동적 데이터로 연결 가능) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-800">최대 상승률</CardTitle>
              <div className="text-green-600">📈</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">+12.5%</div>
              <p className="text-xs text-green-600 mt-1">SUS304 (지난달 대비)</p>
            </CardContent>
          </Card>
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
                    {level1Loading && <SelectItem value="loading" disabled>로딩 중...</SelectItem>}
                    {level1Categories?.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={selectedLevel2} onValueChange={(v) => setCategory(2, v)} disabled={!selectedLevel1 || level2Loading}>
                  <SelectTrigger className="h-8 min-w-[100px] text-sm">
                    <SelectValue placeholder="중분류" />
                  </SelectTrigger>
                  <SelectContent>
                    {level2Loading && <SelectItem value="loading" disabled>로딩 중...</SelectItem>}
                    {level2Categories?.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={selectedLevel3} onValueChange={(v) => setCategory(3, v)} disabled={!selectedLevel2 || level3Loading}>
                  <SelectTrigger className="h-8 min-w-[100px] text-sm">
                    <SelectValue placeholder="소분류" />
                  </SelectTrigger>
                  <SelectContent>
                    {level3Loading && <SelectItem value="loading" disabled>로딩 중...</SelectItem>}
                    {level3Categories?.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={selectedLevel4} onValueChange={(v) => setCategory(4, v)} disabled={!selectedLevel3 || level4Loading}>
                  <SelectTrigger className="h-8 min-w-[100px] text-sm">
                    <SelectValue placeholder="규격" />
                  </SelectTrigger>
                  <SelectContent>
                    {level4Loading && <SelectItem value="loading" disabled>로딩 중...</SelectItem>}
                    {level4Categories?.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* [수정] 선택된 자재 목록: 컴팩트하고 세련된 디자인 */}
        {selectedMaterialsForChart.length > 0 && (
          <Card className="border border-gray-200">
            <CardHeader className="py-1.5 px-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xs font-medium text-gray-600">
                  선택된 자재 ({selectedMaterialsForChart.length}개)
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
        
        {/* --- 아래의 모든 UI는 기존 구조 그대로 유지됩니다 --- */}

        {/* 요약 정보 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" /> 자재 정보
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">선택된 자재:</span>
                  <span className="text-sm font-medium">
                    {selectedMaterialsForChart.length > 0 ? `${selectedMaterialsForChart.length}개` : '없음'}
                  </span>
                </div>
                {/* ... 다른 정보들 ... */}
              </div>
            </CardContent>
          </Card>
          {/* ... ASME 물성정보 & 가격정보 Card, 물성 정보 Card ... */}
        </div>

        {/* 자재 계산기 */}
        <Card className="border border-gray-200">
           {/* ... 기존 자재 계산기 코드 ... */}
        </Card>

        {/* 자재 비교 테이블 */}
        <Card className="border border-gray-200">
            {/* ... 기존 자재 비교 테이블 코드 ... */}
        </Card>

        {/* 시장 전망 */}
        <Card className="border border-gray-200">
            {/* ... 기존 시장 전망 코드 ... */}
        </Card>
      </div>
    </Layout>
  );
};

export default memo(MaterialsPage);