// src/store/materialStore.ts
import { create } from 'zustand';
import { subYears, format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';

type Interval = 'weekly' | 'monthly' | 'yearly';

interface MaterialState {
  // 카테고리 선택 상태
  selectedLevel1: string;
  selectedLevel2: string;
  selectedLevel3: string;
  selectedLevel4: string;
  selectedLevel5: string;
  
  // 차트 설정 상태
  interval: Interval;
  startDate: string;
  endDate: string;
  
  // 차트에 표시될 자재 목록
  selectedMaterialsForChart: string[];
  hiddenMaterials: Set<string>;

  // 상태 변경 액션
  setCategory: (level: 1 | 2 | 3 | 4 | 5, value: string) => void;
  setInterval: (interval: Interval) => void;
  setDateRange: (start: string, end:string) => void;
  
  addMaterialToChart: (material: string) => void;
  removeMaterialFromChart: (material: string) => void;
  toggleMaterialVisibility: (material: string) => void;
  clearAllMaterials: () => void;
}

const useMaterialStore = create<MaterialState>((set) => ({
  // 초기 상태
  selectedLevel1: '',
  selectedLevel2: '',
  selectedLevel3: '',
  selectedLevel4: '',
  selectedLevel5: '',
  
  interval: 'monthly', // 기본값 월간
  startDate: format(subYears(new Date(), 2), 'yyyy-MM-dd'), // 2년 전
  endDate: format(new Date(), 'yyyy-MM-dd'), // 오늘
  
  selectedMaterialsForChart: [],
  hiddenMaterials: new Set(),

  // 카테고리 변경 시 하위 카테고리 초기화 및 상태 업데이트
  setCategory: (level, value) => set((state) => {
    console.log(`setCategory called - level: ${level}, value: ${value}`);
    const updates: Partial<MaterialState> = {};
    
    if (level === 1) {
      updates.selectedLevel1 = value;
      // 1단계 변경 시 하위 모든 단계 초기화
      if (state.selectedLevel1 !== value) {
        updates.selectedLevel2 = '';
        updates.selectedLevel3 = '';
        updates.selectedLevel4 = '';
        updates.selectedLevel5 = '';
      }
      // 1단계 선택 시 해당 카테고리의 모든 자재를 차트에 추가
      if (value) {
        // API 호출로 해당 카테고리의 자재들을 가져와서 차트에 추가
        console.log(`Level 1 category selected: ${value} - loading materials from API`);
        // 비동기로 처리하기 위해 setTimeout 사용
        setTimeout(async () => {
          const materials = await (useMaterialStore.getState() as any).fetchMaterialsByCategory(1, value);
          if (materials.length > 0) {
            useMaterialStore.getState().clearAllMaterials();
            materials.forEach((material: string) => {
              useMaterialStore.getState().addMaterialToChart(material);
            });
            console.log(`Added ${materials.length} materials to chart for category: ${value}`);
          } else {
            console.log(`No materials found for category: ${value}`);
          }
        }, 0);
      }
    } else if (level === 2) {
      updates.selectedLevel2 = value;
      // 2단계 변경 시 하위 단계들 초기화
      if (state.selectedLevel2 !== value) {
        updates.selectedLevel3 = '';
        updates.selectedLevel4 = '';
        updates.selectedLevel5 = '';
      }
      // 2단계 선택 시 해당 카테고리의 모든 자재를 차트에 추가
      if (value) {
        // API 호출로 해당 카테고리의 자재들을 가져와서 차트에 추가
        console.log(`Level 2 category selected: ${value} - loading materials from API`);
        // 비동기로 처리하기 위해 setTimeout 사용
        setTimeout(async () => {
          const materials = await (useMaterialStore.getState() as any).fetchMaterialsByCategory(2, value);
          if (materials.length > 0) {
            useMaterialStore.getState().clearAllMaterials();
            materials.forEach((material: string) => {
              useMaterialStore.getState().addMaterialToChart(material);
            });
            console.log(`Added ${materials.length} materials to chart for category: ${value}`);
          } else {
            console.log(`No materials found for category: ${value}`);
          }
        }, 0);
      }
    } else if (level === 3) {
      updates.selectedLevel3 = value;
      // 3단계 변경 시 하위 단계들 초기화
      if (state.selectedLevel3 !== value) {
        updates.selectedLevel4 = '';
        updates.selectedLevel5 = '';
      }
      // 3단계 선택 시 해당 카테고리의 모든 자재를 차트에 추가
      if (value) {
        // API 호출로 해당 카테고리의 자재들을 가져와서 차트에 추가
        console.log(`Level 3 category selected: ${value} - loading materials from API`);
        // 비동기로 처리하기 위해 setTimeout 사용
        setTimeout(async () => {
          const materials = await (useMaterialStore.getState() as any).fetchMaterialsByCategory(3, value);
          if (materials.length > 0) {
            useMaterialStore.getState().clearAllMaterials();
            materials.forEach((material: string) => {
              useMaterialStore.getState().addMaterialToChart(material);
            });
            console.log(`Added ${materials.length} materials to chart for category: ${value}`);
          } else {
            console.log(`No materials found for category: ${value}`);
          }
        }, 0);
      }
    } else if (level === 4) {
      updates.selectedLevel4 = value;
      // 4단계 변경 시 5단계 초기화
      if (state.selectedLevel4 !== value) {
        updates.selectedLevel5 = '';
      }
      // 4단계 선택 시 자동으로 차트에 추가 (전체 자재명으로 구성)
      if (value) {
        const materialName = value; // 규격명을 자재명으로 사용
        console.log(`Adding material to chart: ${materialName}`);
        if (!state.selectedMaterialsForChart.includes(materialName)) {
          updates.selectedMaterialsForChart = [...state.selectedMaterialsForChart, materialName];
          console.log(`Material added. New list:`, [...state.selectedMaterialsForChart, materialName]);
        } else {
          console.log(`Material already exists in chart: ${materialName}`);
        }
      }
    } else if (level === 5) {
      updates.selectedLevel5 = value;
      // 5단계 선택 시 자동으로 차트에 추가 (상세규격명을 자재명으로 사용)
      if (value) {
        const materialName = value; // 상세규격명을 자재명으로 사용
        console.log(`Adding material to chart: ${materialName}`);
        if (!state.selectedMaterialsForChart.includes(materialName)) {
          updates.selectedMaterialsForChart = [...state.selectedMaterialsForChart, materialName];
          console.log(`Material added. New list:`, [...state.selectedMaterialsForChart, materialName]);
        } else {
          console.log(`Material already exists in chart: ${materialName}`);
        }
      }
    }
    
    console.log('setCategory updates:', updates);
    return updates;
  }),
  
  setInterval: (interval) => set({ interval }),
  setDateRange: (start, end) => set({ startDate: start, endDate: end }),

  addMaterialToChart: (material) => set((state) => {
    if (state.selectedMaterialsForChart.includes(material)) return {};
    return { selectedMaterialsForChart: [...state.selectedMaterialsForChart, material] };
  }),

  removeMaterialFromChart: (material) => set((state) => {
    const newHidden = new Set(state.hiddenMaterials);
    newHidden.delete(material);
    return {
      selectedMaterialsForChart: state.selectedMaterialsForChart.filter((m) => m !== material),
      hiddenMaterials: newHidden,
    };
  }),

  toggleMaterialVisibility: (material) => set((state) => {
    const newHidden = new Set(state.hiddenMaterials);
    if (newHidden.has(material)) {
      newHidden.delete(material);
    } else {
      newHidden.add(material);
    }
    return { hiddenMaterials: newHidden };
  }),
  
  clearAllMaterials: () => set({ selectedMaterialsForChart: [], hiddenMaterials: new Set() }),

  // 카테고리별 자재 목록 가져오기 함수
  fetchMaterialsByCategory: async (level: number, categoryName: string) => {
    try {
      let query = supabase.from('kpi_price_data').select('specification').limit(10);
      
      if (level === 1) {
        query = query.eq('major_category', categoryName);
      } else if (level === 2) {
        query = query.eq('middle_category', categoryName);
      } else if (level === 3) {
        query = query.eq('specification', categoryName);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching materials:', error);
        return [];
      }
      
      // 중복 제거하고 specification만 추출
      const materials = [...new Set(data.map(item => item.specification))];
      console.log(`Fetched ${materials.length} materials for ${categoryName} (level ${level})`);
      return materials;
    } catch (error) {
      console.error('Error in fetchMaterialsByCategory:', error);
      return [];
    }
  },
}));

export default useMaterialStore;