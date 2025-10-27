/**
 * calculations.ts - 엔지니어링 계산 유틸리티 함수들
 * 
 * 🎯 기능:
 * - Tank 부피/무게 계산
 * - NPSH (Net Positive Suction Head) 계산  
 * - 펌프 상사법칙 계산
 * - 기타 엔지니어링 계산
 * 
 * 📝 특징:
 * - 백엔드 없이 프론트엔드에서 직접 계산
 * - 순수 JavaScript/TypeScript 함수
 * - 실시간 계산 결과 제공
 */

// ==================== 타입 정의 ====================
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
  thickness?: number;
  density?: number;
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

// ==================== 재질별 밀도 (kg/m³) ====================
const MATERIAL_DENSITIES = {
  carbon: 7850,      // 탄소강
  stainless: 8000,   // 스테인리스강
  aluminum: 2700,    // 알루미늄
  copper: 8960,      // 구리
  brass: 8500,       // 황동
  titanium: 4500,    // 티타늄
  plastic: 950,      // 플라스틱 (PE)
  fiberglass: 1800   // FRP
};

// ==================== Tank 부피/무게 계산 ====================
export function calculateTankVolume(input: TankCalculationInput): CalculationResult {
  const { 
    diameter, 
    height, 
    topHeadType = 'flat', 
    bottomHeadType = 'flat', 
    material = 'carbon',
    thickness = 6, // mm 단위
    density: inputDensity
  } = input;
  
  if (diameter <= 0 || height <= 0) {
    throw new Error('직경과 높이는 0보다 커야 합니다.');
  }

  const radius = diameter / 2;
  
  // 원통 부피 계산
  const cylinderVolume = Math.PI * Math.pow(radius, 2) * height;
  
  // 헤드 부피 계산 (반구형 헤드의 경우)
  let topHeadVolume = 0;
  let bottomHeadVolume = 0;
  
  if (topHeadType === 'hemispherical') {
    topHeadVolume = (2/3) * Math.PI * Math.pow(radius, 3);
  } else if (topHeadType === 'elliptical') {
    // 2:1 타원형 헤드 (높이 = 직경/4)
    const headHeight = diameter / 4;
    topHeadVolume = (Math.PI / 6) * Math.pow(diameter, 2) * headHeight;
  }
  
  if (bottomHeadType === 'hemispherical') {
    bottomHeadVolume = (2/3) * Math.PI * Math.pow(radius, 3);
  } else if (bottomHeadType === 'elliptical') {
    const headHeight = diameter / 4;
    bottomHeadVolume = (Math.PI / 6) * Math.pow(diameter, 2) * headHeight;
  }
  
  // 총 부피
  const totalVolume = cylinderVolume + topHeadVolume + bottomHeadVolume;
  
  // 무게 계산 (입력된 두께 또는 기본값 사용)
  const wallThickness = thickness / 1000; // mm를 m로 변환
  const shellSurfaceArea = Math.PI * diameter * height;
  const topBottomArea = 2 * Math.PI * Math.pow(radius, 2);
  const totalSurfaceArea = shellSurfaceArea + topBottomArea;
  const materialVolume = totalSurfaceArea * wallThickness;
  
  // 밀도 계산 (입력된 밀도 또는 재질별 기본값 사용)
  const materialDensity = inputDensity || MATERIAL_DENSITIES[material as keyof typeof MATERIAL_DENSITIES] || MATERIAL_DENSITIES.carbon;
  const weight = materialVolume * materialDensity;
  
  return {
    volume: Math.round(totalVolume * 1000) / 1000, // L 단위로 반올림
    weight: Math.round(weight * 100) / 100, // kg 단위로 반올림
    unit: 'L',
    formula: `V = π × r² × h + V_heads\n` +
             `V = π × ${radius.toFixed(2)}² × ${height} + ${(topHeadVolume + bottomHeadVolume).toFixed(3)}\n` +
             `V = ${totalVolume.toFixed(3)} m³ = ${(totalVolume * 1000).toFixed(1)} L`,
    inputs: {
      diameter,
      height,
      topHeadType,
      bottomHeadType,
      material,
      thickness: `${thickness} mm`,
      density: `${materialDensity} kg/m³`
    }
  };
}

// ==================== NPSH 계산 ====================
export function calculateNPSH(input: NPSHCalculationInput): CalculationResult {
  const { atmospheric_pressure, vapor_pressure, static_head, friction_loss } = input;
  
  if (atmospheric_pressure <= 0 || vapor_pressure < 0) {
    throw new Error('압력 값이 올바르지 않습니다.');
  }
  
  // NPSHA = (Pa - Pv)/(ρ×g) + Hs - Hf
  const waterDensity = 1000; // kg/m³
  const gravity = 9.81; // m/s²
  
  const pressureHead = (atmospheric_pressure - vapor_pressure) * 1000 / (waterDensity * gravity);
  const npshAvailable = pressureHead + static_head - friction_loss;
  
  return {
    npsh: Math.round(npshAvailable * 100) / 100,
    unit: 'm',
    formula: `NPSHA = (Pa - Pv)/(ρ×g) + Hs - Hf
= (${atmospheric_pressure} - ${vapor_pressure})×1000/(1000×9.81) + ${static_head} - ${friction_loss}
= ${pressureHead.toFixed(2)} + ${static_head} - ${friction_loss} = ${npshAvailable.toFixed(2)} m`,
    inputs: {
      atmospheric_pressure: `${atmospheric_pressure} kPa`,
      vapor_pressure: `${vapor_pressure} kPa`,
      static_head: `${static_head} m (펌프보다 액체가 높으면 양수)`,
      friction_loss: `${friction_loss} m`,
      water_density: `${waterDensity} kg/m³`,
      gravity: `${gravity} m/s²`
    }
  };
}

// ==================== 펌프 상사법칙 계산 ====================
export function calculateAffinity(input: AffinityCalculationInput): CalculationResult {
  const { n1, n2, q1, h1, p1 } = input;
  
  if (n1 <= 0 || n2 <= 0 || q1 <= 0 || h1 <= 0 || p1 <= 0) {
    throw new Error('모든 입력값은 0보다 커야 합니다.');
  }
  
  const speedRatio = n2 / n1;
  
  // 상사법칙 공식
  const q2 = q1 * speedRatio;                    // 유량: Q₂ = Q₁ × (N₂/N₁)
  const h2 = h1 * Math.pow(speedRatio, 2);      // 양정: H₂ = H₁ × (N₂/N₁)²
  const p2 = p1 * Math.pow(speedRatio, 3);      // 동력: P₂ = P₁ × (N₂/N₁)³
  
  return {
    results: {
      flow_rate: Math.round(q2 * 100) / 100,
      head: Math.round(h2 * 100) / 100,
      power: Math.round(p2 * 100) / 100
    },
    units: {
      flow_rate: 'm³/h',
      head: 'm',
      power: 'kW'
    },
    formulas: {
      flow_rate: `Q₂ = Q₁ × (N₂/N₁) = ${q1} × (${n2}/${n1}) = ${q2.toFixed(2)} m³/h`,
      head: `H₂ = H₁ × (N₂/N₁)² = ${h1} × (${n2}/${n1})² = ${h2.toFixed(2)} m`,
      power: `P₂ = P₁ × (N₂/N₁)³ = ${p1} × (${n2}/${n1})³ = ${p2.toFixed(2)} kW`
    },
    inputs: {
      original_speed: `${n1} rpm`,
      new_speed: `${n2} rpm`,
      speed_ratio: speedRatio.toFixed(3),
      original_flow: `${q1} m³/h`,
      original_head: `${h1} m`,
      original_power: `${p1} kW`
    }
  };
}

// ==================== 기타 유틸리티 함수 ====================

/**
 * 압력 단위 변환
 */
export function convertPressure(value: number, from: string, to: string): number {
  const conversions: Record<string, number> = {
    'kPa': 1,
    'bar': 100,
    'psi': 6.895,
    'mmHg': 0.133,
    'atm': 101.325
  };
  
  const baseValue = value * conversions[from];
  return baseValue / conversions[to];
}

/**
 * 유량 단위 변환
 */
export function convertFlowRate(value: number, from: string, to: string): number {
  const conversions: Record<string, number> = {
    'm³/h': 1,
    'L/min': 60/1000,
    'gpm': 0.227,
    'L/s': 3.6
  };
  
  const baseValue = value * conversions[from];
  return baseValue / conversions[to];
}

/**
 * 온도 단위 변환
 */
export function convertTemperature(value: number, from: string, to: string): number {
  let celsius: number;
  
  // 먼저 섭씨로 변환
  switch (from) {
    case 'C':
      celsius = value;
      break;
    case 'F':
      celsius = (value - 32) * 5/9;
      break;
    case 'K':
      celsius = value - 273.15;
      break;
    default:
      celsius = value;
  }
  
  // 목표 단위로 변환
  switch (to) {
    case 'C':
      return celsius;
    case 'F':
      return celsius * 9/5 + 32;
    case 'K':
      return celsius + 273.15;
    default:
      return celsius;
  }
}