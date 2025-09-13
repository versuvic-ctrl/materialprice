// 모든 타입 정의를 한 곳에서 export

// Material types
export type {
  Material,
  MaterialCategory,
  MaterialWithCategory,
  MaterialSearchParams,
  MaterialSearchResult,
  MaterialPriceAlert,
  MaterialComparisonItem,
  MaterialFilter
} from './material';

// Price types
export type {
  PriceHistory,
  PriceHistoryWithMaterial,
  PriceTrend,
  PriceStatistics,
  PriceComparison,
  PriceAlert,
  PriceUpdateLog,
  PriceForecast,
  PriceRange,
  PriceQueryParams
} from './price';

// Chart types
export type {
  ChartDataPoint,
  ChartSeries,
  ChartConfig,
  ChartFilter,
  ChartTooltipData,
  ChartLegendItem,
  ChartAxisConfig,
  ChartMargin,
  ChartDimensions,
  ChartExportOptions,
  ChartAnnotation,
  ChartTheme,
  ChartState,
  ChartActions,
  DashboardChartProps
} from './chart';

// Dashboard types
export type {
  DashboardSummary,
  DashboardCard,
  DashboardChart,
  DashboardWidget,
  DashboardLayout,
  DashboardFilter,
  DashboardState,
  DashboardActions,
  DashboardMetrics,
  DashboardAlert,
  DashboardPreferences,
  DashboardExportOptions,
  DashboardSearchResult
} from './dashboard';

// Common utility types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface UseDataResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch?: () => void;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface NumberRange {
  min: number;
  max: number;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterConfig {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like';
  value: unknown;
}

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: number;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: unknown) => React.ReactNode;
}

export interface TableConfig {
  columns: TableColumn[];
  sortable?: boolean;
  filterable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  selectable?: boolean;
  exportable?: boolean;
}

export interface NotificationConfig {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  actions?: {
    label: string;
    action: () => void;
  }[];
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'ko' | 'en';
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  currency: string;
  notifications: {
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
}

export interface SystemInfo {
  version: string;
  buildDate: string;
  environment: 'development' | 'staging' | 'production';
  features: string[];
  maintenance: {
    scheduled: boolean;
    startTime?: string;
    endTime?: string;
    message?: string;
  };
}