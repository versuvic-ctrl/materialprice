// 대시보드 관련 타입 정의

import { ChartDataPoint, ChartConfig } from './chart';
import { Material, MaterialCategory } from './material';
import { PriceTrend } from './price';

export interface DashboardSummary {
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

export interface DashboardCard {
  id: string;
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon?: string;
  color?: string;
  unit?: string;
  description?: string;
}

export interface DashboardChart {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  data: ChartDataPoint[];
  config: ChartConfig;
  isLoading: boolean;
  error?: string;
  lastUpdated: string;
}

export interface DashboardWidget {
  id: string;
  type: 'card' | 'chart' | 'table' | 'list';
  title: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  data: Record<string, unknown>;
  config: Record<string, unknown>;
  isVisible: boolean;
  isLoading: boolean;
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardFilter {
  categories: string[];
  dateRange: {
    start: string;
    end: string;
  };
  priceRange: {
    min: number;
    max: number;
  };
  materials: string[];
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export interface DashboardState {
  summary: DashboardSummary | null;
  charts: DashboardChart[];
  widgets: DashboardWidget[];
  filter: DashboardFilter;
  layout: DashboardLayout | null;
  isLoading: boolean;
  error: string | null;
  lastRefresh: string;
}

export interface DashboardActions {
  refreshData: () => void;
  updateFilter: (filter: Partial<DashboardFilter>) => void;
  updateLayout: (layout: DashboardLayout) => void;
  addWidget: (widget: DashboardWidget) => void;
  removeWidget: (widgetId: string) => void;
  updateWidget: (widgetId: string, updates: Partial<DashboardWidget>) => void;
}

export interface DashboardMetrics {
  totalValue: number;
  totalChange: number;
  topGainers: PriceTrend[];
  topLosers: PriceTrend[];
  mostVolatile: PriceTrend[];
  recentUpdates: {
    materialId: string;
    materialName: string;
    oldPrice: number;
    newPrice: number;
    changePercent: number;
    updatedAt: string;
  }[];
}

export interface DashboardAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  materialId?: string;
  materialName?: string;
  isRead: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface DashboardPreferences {
  defaultLayout: string;
  refreshInterval: number; // in minutes
  notifications: {
    priceAlerts: boolean;
    systemUpdates: boolean;
    dataErrors: boolean;
  };
  chartDefaults: {
    period: 'daily' | 'weekly' | 'monthly';
    showGrid: boolean;
    showLegend: boolean;
    theme: 'light' | 'dark';
  };
  favoriteCategories: string[];
  favoriteMaterials: string[];
}

export interface DashboardExportOptions {
  format: 'pdf' | 'excel' | 'csv' | 'json';
  includeCharts: boolean;
  includeSummary: boolean;
  includeData: boolean;
  dateRange: {
    start: string;
    end: string;
  };
  categories?: string[];
  materials?: string[];
}

export interface DashboardSearchResult {
  materials: Material[];
  categories: MaterialCategory[];
  totalResults: number;
  searchTerm: string;
  filters: DashboardFilter;
}