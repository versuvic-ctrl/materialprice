// src/store/materialStore.ts
import { create } from 'zustand';
import { subYears, format } from 'date-fns';

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
  resetAllMaterialState: () => void;
}

const useMaterialStore = create<MaterialState>((set) => ({
  // 초기 상태
  selectedLevel1: '',
  selectedLevel2: '',
  selectedLevel3: '',
  selectedLevel4: '',
  selectedLevel5: '',
  
  interval: 'monthly', // 기본값 월간
  startDate: format(new Date(subYears(new Date(), 2).getFullYear(), subYears(new Date(), 2).getMonth(), 1), 'yyyy-MM-dd'), // 2년 전 해당 월의 1일
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
        // 카테고리 변경 시에는 차트 자재 목록을 유지 (사용자가 수동으로 제거해야 함)
      }
      // Level 1 선택 시에는 차트에 자재를 추가하지 않음 (드롭다운 로드만)
      if (value) {
        console.log(`Level 1 category selected: ${value} - only loading dropdown options`);
      }
    } else if (level === 2) {
      updates.selectedLevel2 = value;
      // 2단계 변경 시 하위 단계들 초기화
      if (state.selectedLevel2 !== value) {
        updates.selectedLevel3 = '';
        updates.selectedLevel4 = '';
        updates.selectedLevel5 = '';
        // 카테고리 변경 시에는 차트 자재 목록을 유지 (사용자가 수동으로 제거해야 함)
      }
      // Level 2 선택 시에는 차트에 자재를 추가하지 않음 (드롭다운 로드만)
      if (value) {
        console.log(`Level 2 category selected: ${value} - only loading dropdown options`);
      }
    } else if (level === 3) {
      updates.selectedLevel3 = value;
      // 3단계 변경 시 하위 단계들 초기화
      if (state.selectedLevel3 !== value) {
        updates.selectedLevel4 = '';
        updates.selectedLevel5 = '';
        // 카테고리 변경 시에는 차트 자재 목록을 유지 (사용자가 수동으로 제거해야 함)
      }
      // Level 3 선택 시에는 차트에 자재를 추가하지 않음 (드롭다운 로드만)
      if (value) {
        console.log(`Level 3 category selected: ${value} - only loading dropdown options`);
      }
    } else if (level === 4) {
      updates.selectedLevel4 = value;
      // 4단계 변경 시 5단계 초기화
      if (state.selectedLevel4 !== value) {
        updates.selectedLevel5 = '';
      }
      // 4단계(규격) 선택 시 자동으로 차트에 추가 (전체 자재명으로 구성)
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

  addMaterialToChart: (material) => {
    set((state) => {
      if (!state.selectedMaterialsForChart.includes(material)) {
        return {
          ...state,
          selectedMaterialsForChart: [...state.selectedMaterialsForChart, material]
        };
      }
      return state;
    });
  },

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

  // 모든 자재 관련 상태를 초기화하는 액션
  resetAllMaterialState: () => set({
    selectedLevel1: '',
    selectedLevel2: '',
    selectedLevel3: '',
    selectedLevel4: '',
    selectedLevel5: '',
    selectedMaterialsForChart: [],
    hiddenMaterials: new Set(),
    interval: 'monthly',
    startDate: format(new Date(subYears(new Date(), 2).getFullYear(), subYears(new Date(), 2).getMonth(), 1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  }),

  // 카테고리별 자재 목록 가져오기 함수
  fetchMaterialsByCategory: async (level: number, categoryName: string) => {
    try {
      console.log(`Fetching materials for level ${level}, category: ${categoryName}`);
      
      // Construct API endpoint based on level and categoryName
      // Assuming the API returns an array of objects, each with a 'specification' property
      const response = await fetch(`/api/materials-by-category?level=${level}&categoryName=${encodeURIComponent(categoryName)}`);
      
      if (!response.ok) {
        // Log the response status and text for debugging
        const errorText = await response.text();
        console.error(`HTTP error! status: ${response.status}, response: ${errorText}`);
        
        // Return empty array instead of throwing error to prevent UI breakage
        return [];
      }
      
      const data: { specification: string }[] = await response.json();
      
      // Handle case where API returns empty array (e.g., due to timeout)
      if (!Array.isArray(data)) {
        console.warn('API returned non-array data:', data);
        return [];
      }
      
      // 중복 제거하고 specification만 추출
      const materials = [...new Set(data.map(item => item.specification))].filter(Boolean);
      console.log(`Fetched ${materials.length} materials for ${categoryName} (level ${level})`);
      return materials;
    } catch (error) {
      console.error('Error in fetchMaterialsByCategory:', error);
      // Return empty array instead of throwing to prevent UI breakage
      return [];
    }
  },
}));

export default useMaterialStore;