/**
 * API 클라이언트 모듈
 * 
 * FastAPI 백엔드와의 통신을 담당합니다.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// API 응답 타입 정의
export interface MaterialPrice {
  material: string;
  price: number;
  unit: string;
  change: string;
}

export interface SupabaseMaterial {
  id: number;
  material_name: string;
  price: number;
  unit: string;
  source: string;
  last_updated: string;
  created_at: string;
  // 프론트엔드에서 사용할 추가 필드들
  name?: string;
  category?: string;
  grade?: string;
  current_price?: number;
  previous_price?: number;
  supplier?: string;
  trend?: string;
}

export interface MaterialHistory {
  date: string;
  price: number;
  material: string;
}

export interface CalculationResult {
  value?: number;
  volume?: number;
  npsh?: number;
  results?: {
    flow_rate: number;
    head: number;
    power: number;
  };
  unit?: string;
  units?: {
    flow_rate: string;
    head: string;
    power: string;
  };
  formula?: string;
  formulas?: {
    flow_rate: string;
    head: string;
    power: string;
  };
  inputs?: Record<string, number | string>;
}

export interface TankCalculationInput {
  diameter: number;
  height: number;
  topHeadType?: string;
  bottomHeadType?: string;
  material?: string;
}

export interface NPSHCalculationInput {
  atmospheric_pressure: number;
  vapor_pressure: number;
  static_head: number;
  friction_loss: number;
}

export interface AffinityCalculationInput {
  n1: number;
  n2: number;
  q1: number;
  h1: number;
  p1: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${url}`, error);
      throw error;
    }
  }

  // 자재 가격 관련 API
  async getCurrentPrices(): Promise<Record<string, MaterialPrice>> {
    return this.request<Record<string, MaterialPrice>>('/materials/current');
  }

  async getMaterialHistory(
    material: string, 
    period: string = '30d',
    startDate?: string,
    endDate?: string
  ): Promise<{
    material: string;
    period: string;
    data: MaterialHistory[];
  }> {
    let url = `/materials/history/${material}?period=${period}`;
    if (startDate) {
      url += `&start_date=${startDate}`;
    }
    if (endDate) {
      url += `&end_date=${endDate}`;
    }
    return this.request(url);
  }

  async compareMaterials(materials: string[]): Promise<Record<string, MaterialHistory[]>> {
    const materialsParam = materials.join(',');
    return this.request(`/materials/compare?materials=${materialsParam}`);
  }

  // 계산기 관련 API
  async calculateTankVolume(input: TankCalculationInput): Promise<CalculationResult> {
    return this.request<CalculationResult>('/calculate/tank-volume', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async calculateNPSH(input: NPSHCalculationInput): Promise<CalculationResult> {
    return this.request<CalculationResult>('/calculate/npsh', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async calculateAffinity(input: AffinityCalculationInput): Promise<CalculationResult> {
    return this.request<CalculationResult>('/calculate/affinity', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // Supabase 자재 데이터 가져오기
  async getSupabaseMaterials(): Promise<SupabaseMaterial[]> {
    return this.request<SupabaseMaterial[]>('/materials/supabase');
  }

  // 헬스 체크
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request('/health');
  }
}

// 싱글톤 인스턴스
const apiClient = new ApiClient();

export default apiClient;

// 개별 함수로도 export (편의성을 위해)
export const getCurrentPrices = () => apiClient.getCurrentPrices();
export const getMaterialHistory = (material: string, period?: string, startDate?: string, endDate?: string) => 
  apiClient.getMaterialHistory(material, period, startDate, endDate);
export const compareMaterials = (materials: string[]) => 
  apiClient.compareMaterials(materials);
export const calculateTankVolume = (input: TankCalculationInput) => 
  apiClient.calculateTankVolume(input);
export const calculateNPSH = (input: NPSHCalculationInput) => 
  apiClient.calculateNPSH(input);
export const calculateAffinity = (input: AffinityCalculationInput) => 
  apiClient.calculateAffinity(input);
export const getSupabaseMaterials = () => apiClient.getSupabaseMaterials();
export const healthCheck = () => apiClient.healthCheck();