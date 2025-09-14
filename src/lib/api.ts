/**
 * api.ts - FastAPI 백엔드 통신 클라이언트
 * 
 * 기능:
 * - FastAPI 백엔드 서버와의 HTTP 통신
 * - 자재 가격 데이터 조회 및 비교
 * - 엔지니어링 계산 (탱크 부피, NPSH, 친화법칙)
 * - Supabase 데이터 프록시 접근
 * 
 * 연관 파일:
 * - app/calculator/page.tsx (계산 기능 사용)
 * - components/CalculatorPreview.tsx (계산 미리보기)
 * - lib/supabase.ts (데이터 소스 보완)
 * 
 * 중요도: ⭐⭐ 중요 - 계산 기능과 API 통신 담당
 * 
 * 백엔드 의존성:
 * - FastAPI 서버 (localhost:8000)
 * - Python 계산 엔진
 * - 자재 가격 크롤링 시스템
 */

/** 
 * 백엔드 API 기본 URL
 * 환경변수 NEXT_PUBLIC_API_URL 또는 기본값 localhost:8000 사용
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ==================== 타입 정의 ====================
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

// ==================== 인스턴스 및 편의 함수 ====================

/**
 * API 클라이언트 싱글톤 인스턴스
 * 전역에서 하나의 인스턴스만 사용하여 연결 관리 최적화
 */
const apiClient = new ApiClient();

export default apiClient;

// ==================== 편의 함수 Export ====================
// 클래스 메서드를 직접 호출할 수 있는 함수들
// 사용 예: import { getCurrentPrices } from '@/lib/api'

/** 현재 자재 가격 조회 */
export const getCurrentPrices = () => apiClient.getCurrentPrices();

/** 자재 가격 이력 조회 */
export const getMaterialHistory = (material: string, period?: string, startDate?: string, endDate?: string) => 
  apiClient.getMaterialHistory(material, period, startDate, endDate);

/** 자재 가격 비교 */
export const compareMaterials = (materials: string[]) => 
  apiClient.compareMaterials(materials);

/** 탱크 부피 계산 */
export const calculateTankVolume = (input: TankCalculationInput) => 
  apiClient.calculateTankVolume(input);

/** NPSH 계산 */
export const calculateNPSH = (input: NPSHCalculationInput) => 
  apiClient.calculateNPSH(input);

/** 친화법칙 계산 */
export const calculateAffinity = (input: AffinityCalculationInput) => 
  apiClient.calculateAffinity(input);

/** Supabase 자재 데이터 조회 */
export const getSupabaseMaterials = () => apiClient.getSupabaseMaterials();

/** 백엔드 헬스 체크 */
export const healthCheck = () => apiClient.healthCheck();