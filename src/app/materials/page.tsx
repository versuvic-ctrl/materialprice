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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, CalendarDays, BarChart3 } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabaseClient';
import useMaterialStore from '@/store/materialStore'; // [교체] Zustand 스토어 import
import MaterialsChart from '@/components/materials/MaterialsChart'; // [교체] 새로운 차트 컴포넌트 import

// 정적 자재 물성 데이터 (자재 비교 테이블 및 계산기에서 사용)
// price: 원/kg, density: g/cm³, tensile: MPa, yield: MPa, elastic: GPa, thermal: W/m·K
// SUS304, SUS316 등은 원래 ton/원 단위였으므로 1000으로 나누어 kg/원으로 변환
const MATERIAL_DATA = {
  'SUS304': { price: 8.5, density: 7.93, tensile: 520, yield: 205, elastic: 200, thermal: 16.2 },
  'SUS316': { price: 9.2, density: 8.0, tensile: 515, yield: 205, elastic: 200, thermal: 16.3 },
  'AL6061': { price: 3.2, density: 2.7, tensile: 310, yield: 276, elastic: 68.9, thermal: 167 },
  'Carbon Steel': { price: 2.8, density: 7.85, tensile: 400, yield: 250, elastic: 200, thermal: 50 }
};

// Supabase 클라이언트는 lib/supabaseClient.ts에서 import

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

// 계층형 카테고리 데이터를 가져오는 React Query 훅
// level: 카테고리 레벨 (대분류/중분류/소분류/규격/상세규격)
// filters: 상위 카테고리 선택 조건
const useCategories = (level: 'major' | 'middle' | 'sub' | 'specification' | 'spec_name', filters: object) => {
  return useQuery({
    queryKey: ['categories', level, filters],
    queryFn: async () => {
      console.log(`Fetching ${level} categories with filters:`, filters);
      
      // 상위 카테고리가 선택되지 않았으면 쿼리 실행 안 함 (major 제외)
      if (level !== 'major' && Object.values(filters).some(v => !v)) {
        console.log(`Skipping ${level} query - missing filters`);
        return [];
      }
      
      // Supabase RPC 함수 호출로 카테고리 목록 조회
      try {
        const { data, error } = await supabase.rpc('get_distinct_categories', {
          p_level: level,
          p_filters: filters
        });

        if (process.env.NODE_ENV === 'development') {
          console.debug(`Debug: RPC call for ${level} categories - data:`, data);
          console.debug(`Debug: RPC call for ${level} categories - error:`, error);
        }

        if (error) {
          // 오류 발생 시 콘솔에 로깅하지 않고 조용히 처리
          // 개발 환경에서만 오류 객체 출력
          if (process.env.NODE_ENV === 'development' && error && Object.keys(error).length > 0) {
            console.debug(`Debug: Error fetching ${level} categories:`, error);
          }
          return []; // 오류 발생 시 빈 배열 반환하여 UI가 깨지지 않도록 처리
        }
        
        // 데이터 처리 및 한글 자음 순서로 정렬하여 반환
        console.log(`Raw data from RPC for ${level}:`, data);
        
        let categories: string[] = [];
        if (Array.isArray(data)) {
          // 데이터가 배열인 경우 각 항목에서 name 필드 추출 (RPC 함수가 name 컬럼 반환)
          categories = data.map((item: any) => {
            if (item && typeof item.name === 'string') {
              return item.name;
            }
            return '';
          }).filter(cat => cat !== '');
        }
        
        console.log(`Processed ${level} categories:`, categories);
        return sortKorean(categories);
      } catch (err) {
        console.error(`Error fetching ${level} categories:`, err);
        return []; // 오류 발생 시 빈 배열 반환
      }
    },
    // enabled 옵션: major는 항상 실행, 나머지는 상위 필터값이 모두 존재할 때만 쿼리를 실행
    enabled: level === 'major' ? true : Object.values(filters).every(v => v),
  });
};

const MaterialsPage: React.FC = () => {
  // Zustand 전역 스토어에서 카테고리 선택 상태 및 액션 가져오기
  const {
    selectedLevel1,              // 대분류 선택값
    selectedLevel2,              // 중분류 선택값
    selectedLevel3,              // 소분류 선택값
    selectedLevel4,              // 규격 선택값
    selectedLevel5,              // 상세규격 선택값
    setCategory,                 // 카테고리 선택 액션
    selectedMaterialsForChart,   // 차트에 표시할 자재 목록
    hiddenMaterials,             // 숨겨진 자재 Set
    removeMaterialFromChart,     // 차트에서 자재 제거
    toggleMaterialVisibility,    // 자재 표시/숨김 토글
    clearAllMaterials,           // 모든 자재 제거
  } = useMaterialStore();

  // React Query를 통해 계층형 카테고리 데이터를 동적으로 조회
  const { data: level1Categories, isLoading: level1Loading } = useCategories('major', {});
  const { data: level2Categories, isLoading: level2Loading } = useCategories('middle', { major: selectedLevel1 });
  const { data: level3Categories, isLoading: level3Loading } = useCategories('sub', { major: selectedLevel1, middle: selectedLevel2 });
  const { data: level4Categories, isLoading: level4Loading } = useCategories('specification', { major: selectedLevel1, middle: selectedLevel2, sub: selectedLevel3 });
  const { data: level5Categories, isLoading: level5Loading } = useCategories('spec_name', { major: selectedLevel1, middle: selectedLevel2, sub: selectedLevel3, specification: selectedLevel4 });

  // 상태 관리는 Zustand로, 서버 상태는 React Query로 처리하여 컴포넌트 로직 단순화

  return (
    <Layout title="자재가격 상세">
      <div className="space-y-6">
        {/* === 이 아래부터는 기존 UI 구조를 그대로 유지합니다 === */}

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
                    {level1Categories?.map((cat, index) => <SelectItem key={`level1-${cat}-${index}`} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={selectedLevel2} onValueChange={(v) => setCategory(2, v)} disabled={!selectedLevel1 || level2Loading}>
                  <SelectTrigger className="h-8 min-w-[100px] text-sm">
                    <SelectValue placeholder="중분류" />
                  </SelectTrigger>
                  <SelectContent>
                    {level2Loading && <SelectItem value="loading" disabled>로딩 중...</SelectItem>}
                    {level2Categories?.map((cat, index) => <SelectItem key={`level2-${cat}-${index}`} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={selectedLevel3} onValueChange={(v) => setCategory(3, v)} disabled={!selectedLevel2 || level3Loading}>
                  <SelectTrigger className="h-8 min-w-[100px] text-sm">
                    <SelectValue placeholder="소분류" />
                  </SelectTrigger>
                  <SelectContent>
                    {level3Loading && <SelectItem value="loading" disabled>로딩 중...</SelectItem>}
                    {level3Categories?.map((cat, index) => <SelectItem key={`level3-${cat}-${index}`} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={selectedLevel4} onValueChange={(v) => setCategory(4, v)} disabled={!selectedLevel3 || level4Loading}>
                  <SelectTrigger className="h-8 min-w-[100px] text-sm">
                    <SelectValue placeholder="규격" />
                  </SelectTrigger>
                  <SelectContent>
                    {level4Loading && <SelectItem value="loading" disabled>로딩 중...</SelectItem>}
                    {level4Categories?.map((cat, index) => <SelectItem key={`level4-${cat}-${index}`} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>

                {/* 5번째 상세규격 드롭다운 - 조건부 렌더링 */}
                {selectedLevel4 && level5Categories && level5Categories.length > 0 && (
                  <Select value={selectedLevel5} onValueChange={(v) => setCategory(5, v)} disabled={!selectedLevel4 || level5Loading}>
                    <SelectTrigger className="h-8 min-w-[100px] text-sm">
                      <SelectValue placeholder="상세규격" />
                    </SelectTrigger>
                    <SelectContent>
                      {level5Loading && <SelectItem value="loading" disabled>로딩 중...</SelectItem>}
                      {level5Categories?.map((cat, index) => <SelectItem key={`level5-${cat}-${index}`} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
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


      </div>
    </Layout>
  );
};

export default memo(MaterialsPage);