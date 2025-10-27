'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import dynamic from 'next/dynamic';

// 3D 시각화 컴포넌트 (동적 로딩)
const TankVisualization = dynamic(() => import('@/components/calculator/TankVisualization'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full">3D 모델 로딩 중...</div>
});

// Tank 타입 정의
type TankType = 
  | 'vertical-cylinder'
  | 'horizontal-cylinder'
  | 'rectangular-prism'
  | 'vertical-capsule'
  | 'horizontal-capsule'
  | 'vertical-elliptical'
  | 'horizontal-elliptical'
  | 'cone-bottom'
  | 'cone-top'
  | 'frustum';

// Tank 타입 옵션
const TANK_TYPES = [
  { value: 'vertical-cylinder', label: 'Vertical cylinder' },
  { value: 'horizontal-cylinder', label: 'Horizontal cylinder' },
  { value: 'rectangular-prism', label: 'Rectangular prism' },
  { value: 'vertical-capsule', label: 'Vertical capsule' },
  { value: 'horizontal-capsule', label: 'Horizontal capsule' },
  { value: 'vertical-elliptical', label: 'Vertical elliptical' },
  { value: 'horizontal-elliptical', label: 'Horizontal elliptical' },
  { value: 'cone-bottom', label: 'Cone bottom' },
  { value: 'cone-top', label: 'Cone top' },
  { value: 'frustum', label: 'Frustum (truncated cone, funnel)' },
] as const;

// 단위 타입
type Unit = 'm' | 'mm';

// 계산 결과 타입
interface TankCalculationResult {
  totalVolume: number;
  filledVolume?: number;
  surfaceArea?: number;
  formula: string;
  unit: string;
}

interface TankInputs {
  tankType: TankType;
  unit: string; // 추가된 속성
  diameter: string;
  height: string;
  length: string;
  width: string;
  radius1: string;
  radius2: string;
  coneHeight: string;
  fillHeight: string;
  // cone bottom tank용 추가 필드
  topDiameter: string;
  bottomDiameter: string;
  cylinderHeight: string;
}

export default function TankCalculator() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TankCalculationResult | null>(null);
  const [showFormulas, setShowFormulas] = useState(false);
  const [unit, setUnit] = useState<Unit>('m');
  
  const [tankInputs, setTankInputs] = useState<TankInputs>({
    tankType: 'vertical-cylinder' as TankType,
    unit: 'm',
    // 공통 입력값
    diameter: '',
    height: '',
    length: '',
    width: '',
    radius1: '',
    radius2: '',
    coneHeight: '',
    fillHeight: '',
    topDiameter: '',
    bottomDiameter: '',
    cylinderHeight: '',
  });

  // Tank 타입별 필요한 입력 필드 정의
  const getRequiredFields = (tankType: TankType): string[] => {
    switch (tankType) {
      case 'vertical-cylinder':
        return ['diameter', 'height'];
      case 'horizontal-cylinder':
        return ['diameter', 'length', 'fillHeight'];
      case 'rectangular-prism':
        return ['length', 'width', 'height', 'fillHeight'];
      case 'vertical-capsule':
        return ['length', 'diameter', 'fillHeight'];
      case 'horizontal-capsule':
        return ['diameter', 'length', 'fillHeight'];
      case 'vertical-elliptical':
      case 'horizontal-elliptical':
        return ['width', 'height', 'length', 'fillHeight'];
      case 'cone-bottom':
        return ['topDiameter', 'bottomDiameter', 'cylinderHeight', 'coneHeight', 'fillHeight'];
      case 'cone-top':
        return ['topDiameter', 'bottomDiameter', 'cylinderHeight', 'coneHeight', 'fillHeight'];
      case 'frustum':
        return ['topDiameter', 'bottomDiameter', 'coneHeight', 'fillHeight'];
      default:
        return [];
    }
  };

  // 단위 변환 함수
  const convertUnit = (value: number, fromUnit: Unit, toUnit: Unit): number => {
    if (fromUnit === toUnit) return value;
    if (fromUnit === 'm' && toUnit === 'mm') return value * 1000;
    if (fromUnit === 'mm' && toUnit === 'm') return value / 1000;
    return value;
  };

  // Tank 부피 계산 함수
  const calculateTankVolume = (): TankCalculationResult => {
    const inputs = tankInputs;
    const { tankType } = inputs;
    
    // 입력값을 숫자로 변환 (현재 단위 기준)
    const diameter = parseFloat(inputs.diameter) || 0;
    const height = parseFloat(inputs.height) || 0;
    const length = parseFloat(inputs.length) || 0;
    const width = parseFloat(inputs.width) || 0;
    const radius1 = parseFloat(inputs.radius1) || 0;
    const radius2 = parseFloat(inputs.radius2) || 0;
    const coneHeight = parseFloat(inputs.coneHeight) || 0;
    const fillHeight = parseFloat(inputs.fillHeight) || 0;
    const topDiameter = parseFloat(inputs.topDiameter) || 0;
    const bottomDiameter = parseFloat(inputs.bottomDiameter) || 0;
    const cylinderHeight = parseFloat(inputs.cylinderHeight) || 0;
    
    const radius = diameter / 2;
    let totalVolume = 0;
    let filledVolume: number | undefined;
    let formula = '';
    
    switch (tankType) {
      case 'vertical-cylinder':
        totalVolume = Math.PI * Math.pow(radius, 2) * height;
        formula = 'V = π × r² × h = π × (d/2)² × h';
        if (fillHeight > 0) {
          filledVolume = Math.PI * Math.pow(radius, 2) * fillHeight;
        }
        break;
        
      case 'horizontal-cylinder':
        totalVolume = Math.PI * Math.pow(radius, 2) * length;
        formula = 'V = π × r² × l = π × (d/2)² × l';
        if (fillHeight > 0) {
          // 수평 원통의 부분 채움 계산 (복잡한 공식)
          const theta = 2 * Math.acos((radius - fillHeight) / radius);
          const segmentArea = 0.5 * Math.pow(radius, 2) * (theta - Math.sin(theta));
          filledVolume = segmentArea * length;
        }
        break;
        
      case 'rectangular-prism':
        totalVolume = length * width * height;
        formula = 'V = l × w × h';
        if (fillHeight > 0) {
          filledVolume = length * width * fillHeight;
        }
        break;
        
      case 'vertical-capsule':
        // 캡슐 = 원통 + 2개의 반구 = 원통 + 1개의 완전한 구
        // length는 원통 부분의 길이, diameter는 직경
        const cylindricalLength = length; // 'length' from inputs is the cylindrical part
        const sphereRadius = radius; // diameter / 2

        const capsuleCylinderVolume = Math.PI * Math.pow(sphereRadius, 2) * cylindricalLength;
        const sphereVolume = (4/3) * Math.PI * Math.pow(sphereRadius, 3);
        totalVolume = capsuleCylinderVolume + sphereVolume;
        formula = 'V = π × (d/2)² × (4/3 × d/2 + l) = π × r² × l + (4/3) × π × r³';

        if (fillHeight > 0) {
          const d = diameter;
          const f = fillHeight;
          const l = cylindricalLength; // length of cylindrical section

          if (f < d / 2) {
            // Case 1: Liquid only in the bottom hemisphere
            filledVolume = (Math.PI * Math.pow(f, 2) / 3) * (1.5 * d - f);
          } else if (f >= d / 2 && f < d / 2 + l) {
            // Case 2: Liquid fills bottom hemisphere and part of cylindrical section
            const hemisphereVolume = (2/3) * Math.PI * Math.pow(d / 2, 3);
            const filledCylinderHeight = f - (d / 2);
            const filledCylinderVolume = Math.PI * Math.pow(d / 2, 2) * filledCylinderHeight;
            filledVolume = hemisphereVolume + filledCylinderVolume;
          } else if (f >= d / 2 + l) {
            // Case 3: Liquid fills bottom hemisphere, cylindrical section, and and part of top hemisphere
            const totalCapsuleVolume = totalVolume; // Use the calculated total volume
            const emptyHeight = (d / 2 + l + d / 2) - f; // Total height - filled height
            
            // Calculate volume of empty spherical cap at the top
            // This is the same formula as Case 1, but with emptyHeight
            const emptySphericalCapVolume = (Math.PI * Math.pow(emptyHeight, 2) / 3) * (1.5 * d - emptyHeight);
            
            filledVolume = totalCapsuleVolume - emptySphericalCapVolume;
          }
        }
        break;
        
      case 'horizontal-capsule':
        // 수평 캡슐 = 원통 + 2개의 반구 = 원통 + 1개의 완전한 구
        // length는 원통 부분의 길이 (사용자 입력값)
        const hCylinderLength = length; // length is the cylindrical part length
        const hCylinderVolume = Math.PI * Math.pow(radius, 2) * hCylinderLength;
        const hSphereVolume = (4/3) * Math.PI * Math.pow(radius, 3);
        totalVolume = hCylinderVolume + hSphereVolume;
        formula = 'V = π × r² × l + (4/3) × π × r³';
        if (fillHeight > 0) {
          const d = diameter;
            const r = radius;
            const l_cyl = hCylinderLength; // cylindrical part length
            const f = fillHeight; // overall fill height from the bottom of the capsule

            let currentFilledVolume = 0;

          // Volume of liquid in the cylindrical part (horizontal cylinder segment)
          const V_cyl_filled_segment = l_cyl * (Math.pow(r, 2) * Math.acos((r - f) / r) - (r - f) * Math.sqrt(2 * r * f - Math.pow(f, 2)));

          // Volume of liquid in the two spherical ends (equivalent to one sphere filled to height 'f')
          const V_sphere_filled_cap = (Math.PI * Math.pow(f, 2) / 3) * (3 * r - f);

          currentFilledVolume = V_cyl_filled_segment + V_sphere_filled_cap;

          filledVolume = currentFilledVolume;
          filledVolume = currentFilledVolume;
        }
        break;
        
      case 'vertical-elliptical':
        totalVolume = (Math.PI * width * height * length) / 4;
        formula = 'V = (π × w × h × l) / 4';
        if (fillHeight > 0 && fillHeight <= height) {
          const L = length;
          const W = width;
          const H = height;
          const F = fillHeight;

          const term1 = 1 - (2 * F) / H;
          const acos_term = Math.acos(term1);

          const sqrt_term_inside = (4 * F) / H - (4 * F * F) / (H * H);
          const sqrt_term = Math.sqrt(sqrt_term_inside);

          const bracket_term = acos_term - (term1 * sqrt_term);

          filledVolume = (L * H * W / 4) * bracket_term;
        }
        break;
        
      case 'horizontal-elliptical':
        totalVolume = (Math.PI * length * width * height) / 4;
        formula = 'V = (π × l × w × h) / 4';
        if (fillHeight > 0 && fillHeight <= height) {
          const L = length;
          const W = width;
          const H = height;
          const F = fillHeight;

          const term1 = 1 - (2 * F) / H;
          const acos_term = Math.acos(term1);

          const sqrt_term_inside = (4 * F) / H - (4 * F * F) / (H * H);
          const sqrt_term = Math.sqrt(sqrt_term_inside);

          const bracket_term = acos_term - (term1 * sqrt_term);

          filledVolume = (L * W * H / 4) * bracket_term;
        }
        break;
        
      case 'cone-bottom':
        // Frustum + Cylinder 공식 사용
        const topDiameter = parseFloat(inputs.topDiameter) || 0;
        const bottomDiameter = parseFloat(inputs.bottomDiameter) || 0;
        const cylinderHeight = parseFloat(inputs.cylinderHeight) || 0;
        
        const coneBottomTopRadius = topDiameter / 2;
        const coneBottomBottomRadius = bottomDiameter / 2;
        
        // Frustum 부피: V = (π × h / 3) × (R₁² + R₁ × R₂ + R₂²)
        const frustumVolume = (Math.PI * coneHeight / 3) * (
          Math.pow(coneBottomTopRadius, 2) + 
          coneBottomTopRadius * coneBottomBottomRadius + 
          Math.pow(coneBottomBottomRadius, 2)
        );
        
        // Cylinder 부피: V = π × r² × h
        const coneBottomCylinderVolume = Math.PI * Math.pow(coneBottomTopRadius, 2) * cylinderHeight;
        
        totalVolume = frustumVolume + coneBottomCylinderVolume;
        formula = 'V = V_frustum + V_cylinder = (π × h_cone / 3) × (r_top² + r_top × r_bot + r_bot²) + π × r_top² × h_cylinder';
        
        // 채워진 부피 계산
        if (fillHeight > 0) {
          if (fillHeight <= coneHeight) {
            // 채움 높이가 원뿔 부분에만 있는 경우
            // 원뿔의 부분 부피 계산 (유사한 원뿔의 비율 사용)
            const fillRatio = fillHeight / coneHeight;
            const fillTopRadius = coneBottomBottomRadius + (coneBottomTopRadius - coneBottomBottomRadius) * fillRatio;
            
            // 채워진 부분의 절두원뿔 부피
            filledVolume = (Math.PI * fillHeight / 3) * (
              Math.pow(coneBottomBottomRadius, 2) + 
              coneBottomBottomRadius * fillTopRadius + 
              Math.pow(fillTopRadius, 2)
            );
          } else {
            // 채움 높이가 원뿔을 넘어 원통 부분까지 있는 경우
            const cylinderFillHeight = fillHeight - coneHeight;
            const filledCylinderVolume = Math.PI * Math.pow(coneBottomTopRadius, 2) * cylinderFillHeight;
            filledVolume = frustumVolume + filledCylinderVolume;
          }
        }
        break;
        
      case 'cone-top':
        // Cone-top tank: Cylinder (bottom) + Frustum (top)
        const coneTopTopDiameter = parseFloat(inputs.topDiameter) || 0;
        const coneTopBottomDiameter = parseFloat(inputs.bottomDiameter) || 0;
        const coneTopCylinderHeight = parseFloat(inputs.cylinderHeight) || 0;
        
        const coneTopTopRadius = coneTopTopDiameter / 2;
        const coneTopBottomRadius = coneTopBottomDiameter / 2;
        
        // Cylinder 부피 (하단): V = π × r² × h
        const coneTopCylinderVolume = Math.PI * Math.pow(coneTopBottomRadius, 2) * coneTopCylinderHeight;
        
        // Frustum 부피 (상단): V = (π × h / 3) × (R₁² + R₁ × R₂ + R₂²)
        const coneTopFrustumVolume = (Math.PI * coneHeight / 3) * (
          Math.pow(coneTopBottomRadius, 2) + 
          coneTopBottomRadius * coneTopTopRadius + 
          Math.pow(coneTopTopRadius, 2)
        );
        
        totalVolume = coneTopCylinderVolume + coneTopFrustumVolume;
        formula = 'V = V_cylinder + V_frustum = π × r_bot² × h_cylinder + (π × h_cone / 3) × (r_bot² + r_bot × r_top + r_top²)';
        
        // 채워진 부피 계산
        if (fillHeight > 0) {
          if (fillHeight <= coneTopCylinderHeight) {
            // 채움 높이가 원통 부분에만 있는 경우
            filledVolume = Math.PI * Math.pow(coneTopBottomRadius, 2) * fillHeight;
          } else {
            // 채움 높이가 원통을 넘어 원뿔 부분까지 있는 경우
            const coneFillHeight = fillHeight - coneTopCylinderHeight;
            
            // cone-top에서는 원뿔이 위쪽에 있으므로, 채움 높이가 증가할수록 반지름이 감소함
            // 채워진 높이에 해당하는 상단 반지름 계산 (bottomRadius에서 topRadius로 선형 감소)
            const coneFillRatio = coneFillHeight / coneHeight;
            const coneFillTopRadius = coneTopBottomRadius - (coneTopBottomRadius - coneTopTopRadius) * coneFillRatio;
            
            // 채워진 부분의 절두원뿔 부피 (아래쪽 반지름: coneTopBottomRadius, 위쪽 반지름: coneFillTopRadius)
            const filledFrustumVolume = (Math.PI * coneFillHeight / 3) * (
              Math.pow(coneTopBottomRadius, 2) + 
              coneTopBottomRadius * coneFillTopRadius + 
              Math.pow(coneFillTopRadius, 2)
            );
            
            filledVolume = coneTopCylinderVolume + filledFrustumVolume;
          }
        }
        break;
        
      case 'frustum':
        // 절두원뿔 (Frustum)
        const frustumTopRadius = (parseFloat(inputs.topDiameter) || 0) / 2;
        const frustumBottomRadius = (parseFloat(inputs.bottomDiameter) || 0) / 2;
        totalVolume = (Math.PI * coneHeight / 3) * (Math.pow(frustumTopRadius, 2) + frustumTopRadius * frustumBottomRadius + Math.pow(frustumBottomRadius, 2));
        
        // 채워진 부피 계산
        if (fillHeight > 0 && fillHeight <= coneHeight) {
          // 채워진 높이에서의 반지름 계산 (선형 보간)
          const fillRatio = fillHeight / coneHeight;
          const fillTopRadius = frustumBottomRadius + (frustumTopRadius - frustumBottomRadius) * fillRatio;
          filledVolume = (Math.PI * fillHeight / 3) * (Math.pow(frustumBottomRadius, 2) + frustumBottomRadius * fillTopRadius + Math.pow(fillTopRadius, 2));
        } else if (fillHeight > coneHeight) {
          filledVolume = totalVolume;
        }
        
        formula = 'V = (π × h / 3) × (R_top² + R_top × R_bottom + R_bottom²)';
        break;
        
      default:
        throw new Error('지원하지 않는 Tank 타입입니다.');
    }
    
    // 단위에 따른 부피 단위 결정
    const volumeUnit = unit === 'm' ? 'm³' : 'mm³';
    
    return {
      totalVolume,
      filledVolume,
      formula,
      unit: volumeUnit
    };
  };

  const handleCalculate = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      // 필수 입력값 검증
      const requiredFields = getRequiredFields(tankInputs.tankType);
      const missingFields = requiredFields.filter(field => {
        // fillHeight는 선택적 필드이므로, 값이 없어도 필수 필드로 간주하지 않음
        if (field === 'fillHeight') {
          return false;
        }
        return !tankInputs[field as keyof typeof tankInputs];
      });
      
      if (missingFields.length > 0) {
        alert(`다음 필드를 입력해주세요: ${missingFields.join(', ')}`);
      }
      
      // 입력값이 양수인지 검증
      const numericFields = requiredFields.map(field => parseFloat(tankInputs[field as keyof typeof tankInputs] as string));
      if (numericFields.some(val => val <= 0)) {
        throw new Error('모든 입력값은 0보다 커야 합니다.');
      }
      
      const calculationResult = calculateTankVolume();
      setResult(calculationResult);
      toast.success('계산이 완료되었습니다!');
    } catch (error: any) {
      console.error('계산 오류:', error);
      toast.error(error.message || '계산 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 입력 필드 렌더링 함수
  const renderInputFields = () => {
    const requiredFields = getRequiredFields(tankInputs.tankType);
    
    return (
      <div className="space-y-4">
        {requiredFields.includes('length') && (
          <div className="flex items-center mb-4">
            <label className="w-1/2 text-sm font-medium text-gray-700 dark:text-gray-300 pr-2">
              {tankInputs.tankType === 'horizontal-cylinder' || tankInputs.tankType === 'horizontal-capsule' ? '길이(Length)' : tankInputs.tankType === 'rectangular-prism' || tankInputs.tankType === 'vertical-elliptical' || tankInputs.tankType === 'horizontal-elliptical' ? '길이(Length)' : '길이(Length)'} ({unit})
            </label>
            <input 
              type="number" 
              value={tankInputs.length ?? ''} 
              onChange={(e) => setTankInputs({...tankInputs, length: e.target.value})} 
              className="w-1/2 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" 
              placeholder="예: 4.0"
            />
          </div>
        )}
        
        {requiredFields.includes('width') && (
          <div className="flex items-center mb-4">
            <label className="w-1/2 text-sm font-medium text-gray-700 dark:text-gray-300 pr-2">
              {tankInputs.tankType === 'rectangular-prism' || tankInputs.tankType === 'vertical-elliptical' || tankInputs.tankType === 'horizontal-elliptical' ? '폭(Width)' : '폭(Width)'} ({unit})
            </label>
            <input 
              type="number" 
              value={tankInputs.width ?? ''} 
              onChange={(e) => setTankInputs({...tankInputs, width: e.target.value})} 
              className="w-1/2 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" 
              placeholder="예: 2.0"
            />
          </div>
        )}

        {requiredFields.includes('height') && (
          <div className="flex items-center mb-4">
            <label className="w-1/2 text-sm font-medium text-gray-700 dark:text-gray-300 pr-2">
              높이(Height) ({unit})
            </label>
            <input 
              type="number" 
              value={tankInputs.height ?? ''} 
              onChange={(e) => setTankInputs({...tankInputs, height: e.target.value})} 
              className="w-1/2 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" 
              placeholder="예: 5.0"
            />
          </div>
        )}

        {requiredFields.includes('diameter') && (
          <div className="flex items-center mb-4">
            <label className="w-1/2 text-sm font-medium text-gray-700 dark:text-gray-300 pr-2">
              {tankInputs.tankType === 'horizontal-cylinder' || tankInputs.tankType === 'horizontal-capsule' ? '직경(Diameter)' : '직경(Diameter)'} ({unit})
            </label>
            <input 
              type="number" 
              value={tankInputs.diameter ?? ''} 
              onChange={(e) => setTankInputs({...tankInputs, diameter: e.target.value})} 
              className="w-1/2 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" 
              placeholder="예: 3.0"
            />
          </div>
        )}
        
        {requiredFields.includes('topDiameter') && (
          <div className="flex items-center mb-4">
            <label className="w-1/2 text-sm font-medium text-gray-700 dark:text-gray-300 pr-2">
              상단 직경(Top Diameter) ({unit})
            </label>
            <input 
              type="number" 
              value={tankInputs.topDiameter ?? ''} 
              onChange={(e) => setTankInputs({...tankInputs, topDiameter: e.target.value})} 
              className="w-1/2 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" 
              placeholder="예: 3.0"
            />
          </div>
        )}
        
        {requiredFields.includes('bottomDiameter') && (
          <div className="flex items-center mb-4">
            <label className="w-1/2 text-sm font-medium text-gray-700 dark:text-gray-300 pr-2">
              하단 직경(Bottom Diameter) ({unit})
            </label>
            <input 
              type="number" 
              value={tankInputs.bottomDiameter ?? ''} 
              onChange={(e) => setTankInputs({...tankInputs, bottomDiameter: e.target.value})} 
              className="w-1/2 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" 
              placeholder="예: 1.0"
            />
          </div>
        )}
        
        {requiredFields.includes('cylinderHeight') && (
          <div className="flex items-center mb-4">
            <label className="w-1/2 text-sm font-medium text-gray-700 dark:text-gray-300 pr-2">
              원통 높이(Cylinder Height) ({unit})
            </label>
            <input 
              type="number" 
              value={tankInputs.cylinderHeight ?? ''} 
              onChange={(e) => setTankInputs({...tankInputs, cylinderHeight: e.target.value})} 
              className="w-1/2 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" 
              placeholder="예: 2.0"
            />
          </div>
        )}

        {requiredFields.includes('coneHeight') && (
          <div className="flex items-center mb-4">
            <label className="w-1/2 text-sm font-medium text-gray-700 dark:text-gray-300 pr-2">
              원뿔 높이(Cone Height) ({unit})
            </label>
            <input 
              type="number" 
              value={tankInputs.coneHeight ?? ''} 
              onChange={(e) => setTankInputs({...tankInputs, coneHeight: e.target.value})} 
              className="w-1/2 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" 
              placeholder="예: 1.0"
            />
          </div>
        )}

        {(tankInputs.tankType === 'vertical-cylinder' || tankInputs.tankType === 'vertical-capsule' || tankInputs.tankType === 'vertical-elliptical' || tankInputs.tankType === 'cone-bottom' || requiredFields.includes('fillHeight')) && (
          <div className="flex items-center mb-4">
            <label className="w-1/2 text-sm font-medium text-gray-700 dark:text-gray-300 pr-2">
              {tankInputs.tankType === 'cone-bottom' ? '채움 높이(Filled) (' : '채움 높이(Filled Height) ('}
              {unit}) - Optional
            </label>
            <input 
              type="number" 
              value={tankInputs.fillHeight ?? ''} 
              onChange={(e) => setTankInputs({...tankInputs, fillHeight: e.target.value})} 
              className="w-1/2 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" 
              placeholder="예: 1.0"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 메인 레이아웃: 모바일에서 1열, 데스크톱에서 2열 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-fit">
        {/* 1열: 입력 필드 */}
        <div className="col-span-1 flex flex-col">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 flex-1">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              🛢️ Tank Volume Calculator
            </h3>
            
            <div className="space-y-4">
              {/* Tank 타입 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tank 타입
                </label>
                <select
                  aria-label="Tank type"
            value={tankInputs.tankType ?? ''}
            onChange={(e) => {
              const newTankType = e.target.value as TankType;
              setTankInputs({
                tankType: newTankType,
                unit: tankInputs.unit,
                length: '',
                width: '',
                height: '', // height 필드 초기화 추가
                diameter: '',
                fillHeight: '',
                radius1: '',
                radius2: '',
                coneHeight: '',
                topDiameter: '',
                bottomDiameter: '',
                cylinderHeight: '',
              });
              setResult(null);
            }}
            className="w-1/2 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
                  {TANK_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* 단위 선택 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  단위
                </label>
                <div className="flex space-x-4 text-xs">
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      value="m" 
                      checked={unit === 'm'} 
                      onChange={(e) => setUnit(e.target.value as Unit)}
                      className="mr-2"
                    />
                    미터 (m)
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      value="mm" 
                      checked={unit === 'mm'} 
                      onChange={(e) => setUnit(e.target.value as Unit)}
                      className="mr-2"
                    />
                    밀리미터 (mm)
                  </label>
                </div>
              </div>
              
              {/* 동적 입력 필드 */}
              {renderInputFields()}
            </div>
            
            {/* 계산 버튼 */}
            <button 
              onClick={handleCalculate} 
              disabled={isLoading}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-3 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  계산 중...
                </>
              ) : (
                '부피 계산하기'
              )}
            </button>
          </div>
        </div>
        
        {/* 2열: 3D 시각화 */}
        <div className="col-span-1 flex flex-col">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 flex-1">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              📊 Tank 시각화
            </h3>
            
            <div className="h-96 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <TankVisualization 
                tankType={tankInputs.tankType}
                diameter={parseFloat(tankInputs.diameter) || undefined}
                height={parseFloat(tankInputs.height) || undefined}
                length={parseFloat(tankInputs.length) || undefined}
                width={parseFloat(tankInputs.width) || undefined}
                radius1={parseFloat(tankInputs.radius1) || undefined}
                radius2={parseFloat(tankInputs.radius2) || undefined}
                topDiameter={parseFloat(tankInputs.topDiameter) || undefined}
                bottomDiameter={parseFloat(tankInputs.bottomDiameter) || undefined}
                cylinderHeight={parseFloat(tankInputs.cylinderHeight) || undefined}
                coneHeight={parseFloat(tankInputs.coneHeight) || undefined}
                unit={unit}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* 계산 결과 */}
      {result && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            📊 계산 결과
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200">총 부피</h4>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {result.totalVolume.toFixed(4)} {result.unit}
              </p>
            </div>
            
            {result.filledVolume !== undefined && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 dark:text-green-200">채워진 부피</h4>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {result.filledVolume.toFixed(4)} {result.unit}
                </p>
              </div>
            )}
          </div>
          
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h4 className="font-semibold mb-2">사용된 공식</h4>
            <p className="font-mono text-sm bg-white dark:bg-gray-800 p-2 rounded">
              {result.formula}
            </p>
          </div>
        </div>
      )}
      
      {/* 상세 공식 및 이론 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <button
          onClick={() => setShowFormulas(!showFormulas)}
          className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
        >
          <h3 className="text-lg font-semibold flex items-center">
            📚 Tank Volume 공식 및 이론
          </h3>
          {showFormulas ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        
        {showFormulas && (
          <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
            <div className="mt-4 space-y-6">
              <div>
                <h4 className="font-semibold text-lg mb-3">지원하는 Tank 타입</h4>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <ul className="text-sm space-y-1">
                    {TANK_TYPES.map(type => (
                      <li key={type.value} className="flex justify-between">
                        <span>{type.label}</span>
                        <span className="text-gray-500">
                          {type.value === 'vertical-cylinder' && 'V = π × r² × h'}
                          {type.value === 'horizontal-cylinder' && 'V = π × r² × l'}
                          {type.value === 'rectangular-prism' && 'V = l × w × h'}
                          {type.value === 'vertical-capsule' && 'V = π × r² × h + (4/3) × π × r³'}
                          {type.value === 'horizontal-capsule' && 'V = π × r² × l + (4/3) × π × r³'}
                          {type.value === 'vertical-elliptical' && 'V = (π × w × h × l) / 4'}
                          {type.value === 'horizontal-elliptical' && 'V = (π × l × w × h) / 4'}
                          {type.value === 'cone-bottom' && 'V = π × r² × h + (π × h_cone / 3) × (r_top² + r_top × r_bot + r_bot²)'}
                          {type.value === 'cone-top' && 'V = π × r² × h + (π × h_cone / 3) × (r_bot² + r_bot × r_top + r_top²)'}
                          {type.value === 'frustum' && 'V = (π × h / 3) × (R_top² + R_top × R_bottom + R_bottom²)'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-lg mb-3">부분 채움 계산</h4>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    채움 높이를 입력하면 부분적으로 채워진 Tank의 부피를 계산할 수 있습니다.
                    수평 원통의 경우 복잡한 원형 세그먼트 공식을 사용합니다.
                  </p>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-lg mb-3">단위 변환</h4>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    미터(m)와 밀리미터(mm) 단위를 지원합니다.
                    부피 단위는 자동으로 m³ 또는 mm³로 표시됩니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}