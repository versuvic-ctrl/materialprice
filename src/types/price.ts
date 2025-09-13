// 가격 관련 타입 정의

export interface PriceHistory {
  id: string;
  materialId: string;
  price: number;
  priceDate: string;
  dataSource: 'KPI' | 'MANUAL' | 'API';
  createdAt: string;
}

export interface PriceHistoryWithMaterial extends PriceHistory {
  material: {
    id: string;
    name: string;
    code: string;
    unit: string;
  };
}

export interface PriceTrend {
  materialId: string;
  materialName: string;
  currentPrice: number;
  previousPrice: number;
  priceChange: number;
  priceChangePercent: number;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

export interface PriceStatistics {
  materialId: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  priceVolatility: number;
  dataPoints: number;
  startDate: string;
  endDate: string;
}

export interface PriceComparison {
  materials: {
    id: string;
    name: string;
    currentPrice: number;
    unit: string;
    priceChange: number;
  }[];
  comparisonDate: string;
  baseDate: string;
}

export interface PriceAlert {
  id: string;
  materialId: string;
  materialName: string;
  alertType: 'threshold' | 'percentage_change' | 'trend_change';
  condition: 'above' | 'below' | 'increase' | 'decrease';
  value: number;
  isActive: boolean;
  lastTriggered?: string;
  createdAt: string;
}

export interface PriceUpdateLog {
  id: string;
  materialId: string;
  oldPrice: number;
  newPrice: number;
  priceChange: number;
  updateSource: 'CRAWLING' | 'MANUAL' | 'API';
  updatedBy?: string;
  updatedAt: string;
  notes?: string;
}

export interface PriceForecast {
  materialId: string;
  forecastDate: string;
  predictedPrice: number;
  confidence: number;
  model: string;
  factors: {
    name: string;
    impact: number;
  }[];
  createdAt: string;
}

export interface PriceRange {
  min: number;
  max: number;
  average: number;
  median: number;
  standardDeviation: number;
}

export interface PriceQueryParams {
  materialIds?: string[];
  startDate?: string;
  endDate?: string;
  period?: 'daily' | 'weekly' | 'monthly';
  aggregation?: 'avg' | 'min' | 'max' | 'last';
  limit?: number;
  offset?: number;
}