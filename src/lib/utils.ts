/**
 * utils.ts - 유틸리티 함수 및 자재 특성 데이터
 *
 * 기능:
 * - Tailwind CSS 클래스 병합 유틸리티 (cn 함수)
 * - 자재 물성 데이터 정의 및 조회 함수
 *
 * 연관 파일:
 * - components/ui/*.tsx (모든 UI 컴포넌트에서 cn 함수 사용)
 * - components/ASMEMaterialSelector.tsx (자재 특성 조회)
 * - app/asme-data/page.tsx (자재 특성 표시)
 *
 * 중요도: ⭐⭐⭐ 필수 - UI 스타일링과 자재 데이터의 핵심
 */

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Tailwind CSS 클래스를 조건부로 병합하는 유틸리티 함수
 * clsx와 tailwind-merge를 결합하여 중복 클래스를 제거하고 조건부 스타일링 지원
 * 
 * @param inputs - 병합할 클래스 값들 (문자열, 객체, 배열 등)
 * @returns 병합된 클래스 문자열
 * 
 * 사용 예시:
 * cn('px-4 py-2', 'bg-blue-500', { 'text-white': isActive })
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 자재의 물리적/기계적 특성을 정의하는 인터페이스
 * 모든 값은 문자열로 저장 (단위 포함 또는 범위 표현)
 */
export interface MaterialProperties {
  tensileStrength: string;      // 인장강도 (MPa)
  yieldStrength: string;        // 항복강도 (MPa)
  elongation: string;           // 연신율 (%)
  hardness: string;             // 경도 (HB)
  meltingPoint: string;         // 융점 (°C)
  density: string;              // 밀도 (g/cm³)
  thermalConductivity: string;  // 열전도율 (W/m·K)
}

/**
 * 주요 자재별 물성 데이터베이스
 * ASME 코드 및 KS 규격 기준 데이터
 * 
 * 포함 자재:
 * - SUS304: 오스테나이트계 스테인리스강 (내식성 우수)
 * - SUS316: 몰리브덴 첨가 스테인리스강 (내식성 더욱 우수)
 * - SS275: 일반구조용 압연강재 (건축/토목용)
 */
export const materialProperties: Record<string, MaterialProperties> = {
  "SUS304": {
    tensileStrength: "520-720",     // 인장강도 520-720 MPa
    yieldStrength: "205",           // 항복강도 205 MPa 이상
    elongation: "40",               // 연신율 40% 이상
    hardness: "170",                // 브리넬 경도 170 HB 이하
    meltingPoint: "1400-1450",      // 융점 1400-1450°C
    density: "8.0",                 // 밀도 8.0 g/cm³
    thermalConductivity: "16.2"     // 열전도율 16.2 W/m·K
  },
  "SUS316": {
    tensileStrength: "520-720",     // 인장강도 520-720 MPa
    yieldStrength: "205",           // 항복강도 205 MPa 이상
    elongation: "40",               // 연신율 40% 이상
    hardness: "165",                // 브리넬 경도 165 HB 이하
    meltingPoint: "1375-1400",      // 융점 1375-1400°C
    density: "8.0",                 // 밀도 8.0 g/cm³
    thermalConductivity: "16.3"     // 열전도율 16.3 W/m·K
  },
  "SS275": {
    tensileStrength: "400-510",     // 인장강도 400-510 MPa
    yieldStrength: "275",           // 항복강도 275 MPa 이상
    elongation: "18-22",            // 연신율 18-22%
    hardness: "116-149",            // 브리넬 경도 116-149 HB
    meltingPoint: "1420-1460",      // 융점 1420-1460°C
    density: "7.85",                // 밀도 7.85 g/cm³
    thermalConductivity: "50"       // 열전도율 50 W/m·K
  }
};

/**
 * 자재명 또는 등급으로 물성 데이터를 조회하는 함수
 * 부분 문자열 매칭을 통해 유연한 검색 지원
 * 
 * @param materialName - 조회할 자재명
 * @param grade - 선택적 등급 정보
 * @returns 매칭되는 자재의 물성 데이터 또는 null
 * 
 * 사용 예시:
 * getMaterialProperties('SUS304') // SUS304 물성 반환
 * getMaterialProperties('스테인리스', 'SUS316') // SUS316 물성 반환
 */
export const getMaterialProperties = (materialName: string, grade?: string): MaterialProperties | null => {
  const propertyKey = Object.keys(materialProperties).find(key => 
    materialName.includes(key) || (grade && grade.includes(key))
  );
  return propertyKey ? materialProperties[propertyKey] : null;
};