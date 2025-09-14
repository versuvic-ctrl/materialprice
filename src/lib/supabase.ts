/**
 * supabase.ts - Supabase 데이터베이스 연동 클라이언트
 * 
 * 기능:
 * - Supabase PostgreSQL 데이터베이스 연결
 * - 자재 가격 데이터 CRUD 작업
 * - 실시간 데이터 조회 및 업데이트
 * - Python 크롤러와 데이터 동기화
 * 
 * 연관 파일:
 * - components/DashboardMiniChart.tsx (실시간 차트 데이터)
 * - components/materials/MaterialsChart.tsx (자재 차트)
 * - app/materials/page.tsx (자재 페이지 데이터)
 * - app/technical-docs/page.tsx (문서 관리)
 * - Python 크롤러 (kpi_crawler.py, data_processor.py)
 * 
 * 중요도: ⭐⭐⭐ 필수 - 데이터 레이어의 핵심
 * 
 * 데이터베이스 테이블:
 * - material_prices: 현재 자재 가격
 * - materialprice_kpi: 자재 가격 이력
 * - documents: 기술 문서 (향후 확장)
 */

import { createClient } from '@supabase/supabase-js'

/** 
 * Supabase 프로젝트 URL
 * 환경변수에서 로드, 없으면 기본값 사용
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co'

/** 
 * Supabase 익명 키 (공개 API 키)
 * 클라이언트 사이드에서 안전하게 사용 가능
 */
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'

/**
 * Supabase 클라이언트 인스턴스
 * 전역에서 사용되는 데이터베이스 연결 객체
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ==================== 타입 정의 ====================

/**
 * 자재 가격 테이블 (material_prices) 스키마
 * 현재 자재의 최신 가격 정보를 저장
 */
export interface MaterialPriceDB {
  id: number                // 기본키 (자동 증가)
  material_name: string     // 자재명 (예: 'SUS304', 'SS400')
  price: number            // 가격 (원/단위)
  unit: string             // 단위 (예: 'kg', 'ton', 'm')
  change_percent: number   // 전일 대비 변화율 (%)
  last_updated: string     // 마지막 업데이트 시간 (ISO 8601)
  created_at: string       // 생성 시간 (ISO 8601)
}

/**
 * 자재 가격 이력 테이블 (materialprice_kpi) 스키마
 * 자재 가격의 시계열 데이터를 저장
 */
export interface MaterialHistoryDB {
  id: number               // 기본키 (자동 증가)
  material_name: string    // 자재명
  price: number           // 해당 날짜의 가격
  date: string            // 가격 기준일 (YYYY-MM-DD)
  created_at: string      // 레코드 생성 시간
}

// ==================== 데이터 조회 함수 ====================

/**
 * 현재 자재 가격 조회
 * material_prices 테이블에서 최신 가격 정보를 가져옴
 * 
 * @returns MaterialPriceDB[] | null - 자재 가격 배열 또는 에러 시 null
 * 
 * 사용처:
 * - 대시보드 실시간 가격 표시
 * - 자재 비교 기능
 * - 가격 알림 시스템
 */
export async function getCurrentPricesFromDB() {
  const { data, error } = await supabase
    .from('material_prices')
    .select('*')
    .order('last_updated', { ascending: false })  // 최신 업데이트 순
  
  if (error) {
    console.error('Error fetching current prices:', error)
    return null
  }
  
  return data
}

/**
 * 자재 가격 이력 조회
 * 특정 자재의 기간별 가격 변동 데이터를 조회
 * 
 * @param materialName - 조회할 자재명
 * @param period - 조회 기간 ('7d', '30d', '1d')
 * @returns MaterialHistoryDB[] | null - 가격 이력 배열 또는 에러 시 null
 * 
 * 사용처:
 * - 자재 가격 차트 생성
 * - 가격 트렌드 분석
 * - 과거 가격 비교
 */
export async function getMaterialHistoryFromDB(materialName: string, period: string = '7d') {
  // 기간에 따른 시작일 계산
  const daysAgo = period === '30d' ? 30 : period === '7d' ? 7 : 1
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysAgo)
  
  const { data, error } = await supabase
    .from('materialprice_kpi')
    .select('*')
    .eq('material_name', materialName)                              // 특정 자재 필터
    .gte('date', startDate.toISOString().split('T')[0])            // 시작일 이후 데이터
    .order('date', { ascending: true })                            // 날짜 오름차순
  
  if (error) {
    console.error('Error fetching material history:', error)
    return null
  }
  
  return data
}

// ==================== 데이터 삽입 함수 ====================

/**
 * 자재 가격 데이터 삽입
 * 새로운 자재 가격 정보를 material_prices 테이블에 저장
 * 
 * @param materialData - 삽입할 자재 가격 데이터 (id, created_at 제외)
 * @returns 삽입된 데이터 또는 에러 시 null
 * 
 * 사용처:
 * - Python 크롤러에서 새 가격 데이터 저장
 * - 수동 가격 업데이트
 * - 데이터 마이그레이션
 */
export async function insertMaterialPrice(materialData: Omit<MaterialPriceDB, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('material_prices')
    .insert([materialData])
    .select()  // 삽입된 데이터 반환
  
  if (error) {
    console.error('Error inserting material price:', error)
    return null
  }
  
  return data
}

/**
 * 자재 가격 이력 데이터 삽입
 * 자재 가격 이력을 materialprice_kpi 테이블에 저장
 * 
 * @param historyData - 삽입할 이력 데이터 (id, created_at 제외)
 * @returns 삽입된 데이터 또는 에러 시 null
 * 
 * 사용처:
 * - 일일 가격 스냅샷 저장
 * - 크롤링 데이터 아카이빙
 * - 백업 데이터 복원
 */
export async function insertMaterialHistory(historyData: Omit<MaterialHistoryDB, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('materialprice_kpi')
    .insert([historyData])
    .select()  // 삽입된 데이터 반환
  
  if (error) {
    console.error('Error inserting material history:', error)
    return null
  }
  
  return data
}