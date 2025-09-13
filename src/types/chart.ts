// 차트 관련 타입 정의

export interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

export interface ChartSeries {
  name: string;
  dataKey: string;
  color: string;
  visible: boolean;
  unit?: string;
}

export interface ChartConfig {
  title: string;
  type: 'line' | 'bar' | 'area' | 'pie' | 'scatter';
  xAxisKey: string;
  yAxisKey?: string;
  series: ChartSeries[];
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  height?: number;
  width?: number;
}

export interface ChartFilter {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
  materials: string[];
  categories: string[];
  aggregation?: 'avg' | 'min' | 'max' | 'sum';
}

export interface ChartTooltipData {
  label: string;
  value: number | string;
  color: string;
  unit?: string;
  payload?: Record<string, unknown>;
}

export interface ChartLegendItem {
  value: string;
  type: string;
  color: string;
  payload: {
    dataKey: string;
    name: string;
    color: string;
  };
}

export interface ChartAxisConfig {
  dataKey: string;
  label?: string;
  unit?: string;
  domain?: [number, number] | ['auto', 'auto'];
  tickFormatter?: (value: unknown) => string;
  hide?: boolean;
}

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ChartDimensions {
  width: number;
  height: number;
  margin: ChartMargin;
}

export interface ChartExportOptions {
  format: 'png' | 'jpg' | 'svg' | 'pdf';
  filename: string;
  quality?: number;
  width?: number;
  height?: number;
}

export interface ChartAnnotation {
  id: string;
  type: 'line' | 'area' | 'point' | 'text';
  x?: number | string;
  y?: number | string;
  x1?: number | string;
  y1?: number | string;
  x2?: number | string;
  y2?: number | string;
  text?: string;
  color?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
}

export interface ChartTheme {
  colors: {
    primary: string[];
    secondary: string[];
    background: string;
    text: string;
    grid: string;
    axis: string;
  };
  fonts: {
    family: string;
    size: {
      small: number;
      medium: number;
      large: number;
    };
  };
  spacing: {
    small: number;
    medium: number;
    large: number;
  };
}

export interface ChartState {
  isLoading: boolean;
  error: string | null;
  data: ChartDataPoint[];
  config: ChartConfig;
  filter: ChartFilter;
  selectedSeries: string[];
  zoomDomain?: {
    x: [number, number];
    y: [number, number];
  };
}

export interface ChartActions {
  updateData: (data: ChartDataPoint[]) => void;
  updateConfig: (config: Partial<ChartConfig>) => void;
  updateFilter: (filter: Partial<ChartFilter>) => void;
  toggleSeries: (seriesName: string) => void;
  resetZoom: () => void;
  exportChart: (options: ChartExportOptions) => void;
}

export interface DashboardChartProps {
  title: string;
  data: ChartDataPoint[];
  config: ChartConfig;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
  onSeriesToggle?: (seriesName: string) => void;
  onFilterChange?: (filter: Partial<ChartFilter>) => void;
}