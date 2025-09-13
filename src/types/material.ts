// 자재 관련 타입 정의

export interface Material {
  id: string;
  name: string;
  code: string;
  specification: string;
  unit: string;
  categoryId: string;
  currentPrice: number;
  priceChange: number;
  lastUpdated: string;
  kpiItemCode?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface MaterialCategory {
  id: string;
  name: string;
  code: string;
  level: number;
  parentId?: string;
  createdAt?: string;
}

export interface MaterialWithCategory extends Material {
  category: MaterialCategory;
}

export interface MaterialSearchParams {
  categoryId?: string;
  level1CategoryId?: string;
  level2CategoryId?: string;
  level3CategoryId?: string;
  level4CategoryId?: string;
  searchTerm?: string;
  sortBy?: 'name' | 'price' | 'priceChange' | 'lastUpdated';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface MaterialSearchResult {
  materials: MaterialWithCategory[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export interface MaterialPriceAlert {
  id: string;
  materialId: string;
  userId: string;
  alertType: 'price_increase' | 'price_decrease' | 'price_threshold';
  threshold?: number;
  isActive: boolean;
  createdAt: string;
  lastTriggered?: string;
}

export interface MaterialComparisonItem {
  material: Material;
  selected: boolean;
  color?: string;
}

export interface MaterialFilter {
  categories: string[];
  priceRange: {
    min: number;
    max: number;
  };
  priceChangeRange: {
    min: number;
    max: number;
  };
  units: string[];
  dateRange: {
    start: string;
    end: string;
  };
}