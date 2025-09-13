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
  
  // 차트 설정 상태
  interval: Interval;
  startDate: string;
  endDate: string;
  
  // 차트에 표시될 자재 목록
  selectedMaterialsForChart: string[];
  hiddenMaterials: Set<string>;

  // 상태 변경 액션
  setCategory: (level: 1 | 2 | 3 | 4, value: string) => void;
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
  
  interval: 'monthly', // 기본값 월간
  startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'), // 1년 전
  endDate: format(new Date(), 'yyyy-MM-dd'), // 오늘
  
  selectedMaterialsForChart: [],
  hiddenMaterials: new Set(),

  // 카테고리 변경 시 하위 카테고리 초기화
  setCategory: (level, value) => set((state) => {
    if (level === 1) {
      return { selectedLevel1: value, selectedLevel2: '', selectedLevel3: '', selectedLevel4: '' };
    }
    if (level === 2) {
      return { selectedLevel2: value, selectedLevel3: '', selectedLevel4: '' };
    }
    if (level === 3) {
      return { selectedLevel3: value, selectedLevel4: '' };
    }
    if (level === 4) {
      // 4단계 선택 시 자동으로 차트에 추가
      if (value && !state.selectedMaterialsForChart.includes(value)) {
          return { selectedLevel4: value, selectedMaterialsForChart: [...state.selectedMaterialsForChart, value] };
      }
      return { selectedLevel4: value };
    }
    return {};
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
}));

export default useMaterialStore;