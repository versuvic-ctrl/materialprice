'use client';

import { useState, useEffect } from 'react';

// 타입 정의
interface DashboardSummary {
  totalMaterials: number;
  totalCategories: number;
  avgPriceChange: number;
  lastUpdated: string;
  highestPriceMaterial: {
    name: string;
    price: number;
    unit: string;
  };
  lowestPriceMaterial: {
    name: string;
    price: number;
    unit: string;
  };
}

interface Category {
  id: string;
  name: string;
  code: string;
  level: number;
  parentId?: string;
}

interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

interface Material {
  id: string;
  name: string;
  code: string;
  specification: string;
  unit: string;
  categoryId: string;
  currentPrice: number;
  priceChange: number;
  lastUpdated: string;
}

// Hook 반환 타입
interface UseDataResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

// 샘플 데이터 생성 함수들
const generateSampleSummary = (): DashboardSummary => ({
  totalMaterials: 1247,
  totalCategories: 156,
  avgPriceChange: 2.3,
  lastUpdated: new Date().toISOString(),
  highestPriceMaterial: {
    name: 'A182 F316L 플랜지',
    price: 125000,
    unit: 'EA'
  },
  lowestPriceMaterial: {
    name: 'PVC 파이프 50A',
    price: 8500,
    unit: 'M'
  }
});

const generateSampleCategories = (level: number, parentId?: string): Category[] => {
  const categories: Record<number, Category[]> = {
    1: [
      { id: '1', name: '철계열 자재', code: 'STEEL', level: 1 },
      { id: '2', name: '비철계열 자재', code: 'NONFERROUS', level: 1 },
      { id: '3', name: '플라스틱 & FRP 자재', code: 'PLASTIC', level: 1 },
      { id: '4', name: 'TEFLON 자재', code: 'TEFLON', level: 1 },
      { id: '5', name: '전기 자재', code: 'ELECTRIC', level: 1 },
      { id: '6', name: '토목 자재', code: 'CIVIL', level: 1 }
    ],
    2: [
      { id: '11', name: '파이프', code: 'PIPE', level: 2, parentId },
      { id: '12', name: '플랜지', code: 'FLANGE', level: 2, parentId },
      { id: '13', name: '피팅', code: 'FITTING', level: 2, parentId },
      { id: '14', name: '밸브', code: 'VALVE', level: 2, parentId }
    ],
    3: [
      { id: '111', name: 'A106 Gr.B', code: 'A106B', level: 3, parentId },
      { id: '112', name: 'A53 Gr.B', code: 'A53B', level: 3, parentId },
      { id: '113', name: 'A312 TP316L', code: 'A312', level: 3, parentId }
    ],
    4: [
      { id: '1111', name: '15A (1/2")', code: '15A', level: 4, parentId },
      { id: '1112', name: '20A (3/4")', code: '20A', level: 4, parentId },
      { id: '1113', name: '25A (1")', code: '25A', level: 4, parentId },
      { id: '1114', name: '32A (1-1/4")', code: '32A', level: 4, parentId },
      { id: '1115', name: '40A (1-1/2")', code: '40A', level: 4, parentId },
      { id: '1116', name: '50A (2")', code: '50A', level: 4, parentId }
    ]
  };
  
  return categories[level] || [];
};

const generateSampleChartData = (period: string, startDate: string, endDate: string): ChartDataPoint[] => {
  const data: ChartDataPoint[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const current = new Date(start);
  let increment: number;
  
  switch (period) {
    case 'daily':
      increment = 1;
      break;
    case 'weekly':
      increment = 7;
      break;
    case 'monthly':
      increment = 30;
      break;
    default:
      increment = 30;
  }
  
  while (current <= end && data.length < 50) {
    data.push({
      date: current.toISOString().split('T')[0],
      'A106 Gr.B 파이프': Math.floor(Math.random() * 50000) + 30000,
      'A182 F316L 플랜지': Math.floor(Math.random() * 80000) + 100000,
      'PVC 파이프': Math.floor(Math.random() * 5000) + 8000,
      'PTFE 라이닝 파이프': Math.floor(Math.random() * 200000) + 300000
    });
    
    current.setDate(current.getDate() + increment);
  }
  
  return data;
};

const generateSampleMaterials = (categoryId?: string): Material[] => {
  const materials: Material[] = [
    {
      id: '1',
      name: 'A106 Gr.B 파이프 50A',
      code: 'A106B-50A',
      specification: 'ASTM A106 Grade B',
      unit: 'M',
      categoryId: '1111',
      currentPrice: 45000,
      priceChange: 2.5,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '2',
      name: 'A182 F316L 플랜지 50A',
      code: 'A182F316L-50A',
      specification: 'ASTM A182 F316L',
      unit: 'EA',
      categoryId: '1112',
      currentPrice: 125000,
      priceChange: -1.2,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '3',
      name: 'PVC 파이프 50A',
      code: 'PVC-50A',
      specification: 'KS M 3404',
      unit: 'M',
      categoryId: '3111',
      currentPrice: 8500,
      priceChange: 0.8,
      lastUpdated: new Date().toISOString()
    }
  ];
  
  if (categoryId) {
    return materials.filter(m => m.categoryId === categoryId);
  }
  
  return materials;
};

// Custom Hooks
export const useDashboardSummary = (): UseDataResult<DashboardSummary> => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // 실제 API 호출 대신 샘플 데이터 사용
        await new Promise(resolve => setTimeout(resolve, 500)); // 로딩 시뮬레이션
        setData(generateSampleSummary());
        setError(null);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError('데이터를 불러오는데 실패했습니다.');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, isLoading, error };
};

export const useChartData = (period: string, startDate: string, endDate: string): UseDataResult<ChartDataPoint[]> => {
  const [data, setData] = useState<ChartDataPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 300));
        setData(generateSampleChartData(period, startDate, endDate));
        setError(null);
      } catch (err) {
        console.error('Failed to fetch chart data:', err);
        setError('차트 데이터를 불러오는데 실패했습니다.');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [period, startDate, endDate]);

  return { data, isLoading, error };
};

export const useLevel1Categories = (): UseDataResult<Category[]> => {
  const [data, setData] = useState<Category[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 200));
        setData(generateSampleCategories(1));
        setError(null);
      } catch (err) {
        console.error('Failed to fetch level1 category data:', err);
        setError('카테고리 데이터를 불러오는데 실패했습니다.');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, isLoading, error };
};

export const useLevel2Categories = (parentId: string): UseDataResult<Category[]> => {
  const [data, setData] = useState<Category[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parentId) {
      setData(null);
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 200));
        setData(generateSampleCategories(2, parentId));
        setError(null);
      } catch (err) {
        console.error('Failed to fetch level2 category data:', err);
        setError('카테고리 데이터를 불러오는데 실패했습니다.');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [parentId]);

  return { data, isLoading, error };
};

export const useLevel3Categories = (parentId: string): UseDataResult<Category[]> => {
  const [data, setData] = useState<Category[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parentId) {
      setData(null);
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 200));
        setData(generateSampleCategories(3, parentId));
        setError(null);
      } catch (err) {
        console.error('Failed to fetch level3 category data:', err);
        setError('카테고리 데이터를 불러오는데 실패했습니다.');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [parentId]);

  return { data, isLoading, error };
};

export const useLevel4Categories = (parentId: string): UseDataResult<Category[]> => {
  const [data, setData] = useState<Category[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parentId) {
      setData(null);
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 200));
        setData(generateSampleCategories(4, parentId));
        setError(null);
      } catch (err) {
        console.error('Failed to fetch level4 category data:', err);
        setError('카테고리 데이터를 불러오는데 실패했습니다.');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [parentId]);

  return { data, isLoading, error };
};

export const useMaterials = (categoryId?: string): UseDataResult<Material[]> => {
  const [data, setData] = useState<Material[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 300));
        setData(generateSampleMaterials(categoryId));
        setError(null);
      } catch (err) {
      console.error('Failed to fetch material data:', err);
      setError('자재 데이터를 불러오는데 실패했습니다.');
      setData(null);
    } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [categoryId]);

  return { data, isLoading, error };
};