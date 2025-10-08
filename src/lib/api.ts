import { createClient } from '@supabase/supabase-js';

/**
 * api.ts - API 클라이언트 및 Supabase 연동
 * 
 * 🎯 기능:
 * - Supabase 클라이언트 설정
 * - 로컬 엔지니어링 계산 (백엔드 불필요)
 * - 데이터 CRUD 작업
 * - 인증 및 권한 관리
 * 
 * 📝 연관 파일:
 * - src/app/materials/page.tsx (재료 데이터 조회)
 * - src/app/calculator/page.tsx (계산기 로컬 호출)
 * - src/components/charts/ (차트 데이터 API)
 * - src/utils/calculations.ts (엔지니어링 계산 함수)
 * 
 * 🔧 의존성:
 * - Supabase 데이터베이스 (재료 데이터)
 * - 로컬 JavaScript 계산 함수
 */

// 환경변수 확인 함수
export const isSupabaseConfigured = () => {
  return process.env.NEXT_PUBLIC_SUPABASE_URL && 
         process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
         process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co';
};

// Supabase 클라이언트 지연 초기화 (빌드 시 오류 방지)
let _supabaseClient: ReturnType<typeof createClient> | null = null;

export const getSupabaseClient = () => {
  if (!_supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder';
    
    _supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabaseClient;
};

// 하위 호환성을 위한 supabase export (지연 초기화 사용)
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    return getSupabaseClient()[prop as keyof ReturnType<typeof createClient>];
  }
});

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
  weight?: number;
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

// ==================== 엔지니어링 계산 함수 (서버 API 호출) ====================

/**
 * 탱크 부피 및 무게 계산 (서버 API 호출)
 * @param input 탱크 계산 입력 데이터
 * @returns 계산 결과 (부피, 무게, 공식 등)
 */
export async function calculateTankVolumeAPI(input: TankCalculationInput): Promise<CalculationResult> {
  try {
    const response = await fetch('/api/calculations/tank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '서버 오류가 발생했습니다.');
    }

    return await response.json();
  } catch (error) {
    console.error('Tank volume calculation error:', error);
    throw new Error(`탱크 부피 계산 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

/**
 * NPSH (Net Positive Suction Head) 계산 (서버 API 호출)
 * @param input NPSH 계산 입력 데이터
 * @returns 계산 결과 (NPSH 값, 공식 등)
 */
export async function calculateNPSHAPI(input: NPSHCalculationInput): Promise<CalculationResult> {
  try {
    const response = await fetch('/api/calculations/npsh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '서버 오류가 발생했습니다.');
    }

    return await response.json();
  } catch (error) {
    console.error('NPSH calculation error:', error);
    throw new Error(`NPSH 계산 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

/**
 * 펌프 상사법칙 계산 (서버 API 호출)
 * @param input 상사법칙 계산 입력 데이터
 * @returns 계산 결과 (유량, 양정, 동력 등)
 */
export async function calculateAffinityAPI(input: AffinityCalculationInput): Promise<CalculationResult> {
  try {
    const response = await fetch('/api/calculations/affinity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '서버 오류가 발생했습니다.');
    }

    return await response.json();
  } catch (error) {
    console.error('Affinity calculation error:', error);
    throw new Error(`상사법칙 계산 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

// ==================== Supabase 데이터 관련 함수 ====================

/**
 * Supabase에서 자재 데이터 조회
 */
export async function getSupabaseMaterials(): Promise<SupabaseMaterial[]> {
  try {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Supabase materials fetch error:', error);
    throw new Error(`자재 데이터 조회 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

/**
 * 자재 가격 이력 조회 (모의 데이터)
 */
export async function getMaterialHistory(
  material: string
): Promise<MaterialHistory[]> {
  // 실제 구현에서는 Supabase나 외부 API에서 데이터를 가져옴
  // 현재는 모의 데이터 반환
  const mockData: MaterialHistory[] = [
    { date: '2024-01-01', price: 100, material },
    { date: '2024-01-15', price: 105, material },
    { date: '2024-01-30', price: 98, material },
  ];
  
  return mockData;
}

// ==================== API 클라이언트 인스턴스 ====================

/**
 * API 클라이언트 인스턴스 (로컬 계산 함수 사용)
 * 백엔드 서버 없이 프론트엔드에서 직접 계산 처리
 */
const apiClient = {
  // 계산기 관련 메서드 (로컬 함수 호출)
  calculateTankVolume: calculateTankVolumeAPI,
  calculateNPSH: calculateNPSHAPI,
  calculateAffinity: calculateAffinityAPI,
  
  // Supabase 데이터 관련 메서드
  getSupabaseMaterials,
  getMaterialHistory,
};

// 기본 내보내기 (하위 호환성)
export default apiClient;

// ==================== 편의 함수 Export ====================
// 직접 호출할 수 있는 함수들
// 사용 예: import { calculateTankVolume } from '@/lib/api'

/** 탱크 부피 계산 */
export const calculateTankVolumeExport = (input: TankCalculationInput) => 
  apiClient.calculateTankVolume(input);

/** NPSH 계산 */
export const calculateNPSHExport = (input: NPSHCalculationInput) => 
  apiClient.calculateNPSH(input);

/** 상사법칙 계산 */
export const calculateAffinityExport = (input: AffinityCalculationInput) => 
  apiClient.calculateAffinity(input);

/** Supabase 자재 데이터 조회 */
export const getSupabaseMaterialsExport = () => apiClient.getSupabaseMaterials();

/** 자재 가격 이력 조회 */
export const getMaterialHistoryExport = (material: string) => 
  apiClient.getMaterialHistory(material);