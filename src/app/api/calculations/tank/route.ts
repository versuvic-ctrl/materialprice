import { NextRequest, NextResponse } from 'next/server';

// 자재 밀도 데이터 (kg/m³)
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

interface TankCalculationInput {
  diameter: number;
  height: number;
  topHeadType?: string;
  bottomHeadType?: string;
  material?: string;
}

interface CalculationResult {
  volume?: number;
  weight?: number;
  unit?: string;
  formula?: string;
  inputs?: Record<string, number | string>;
}

export async function POST(request: NextRequest) {
  try {
    const input: TankCalculationInput = await request.json();
    
    // 입력값 검증
    if (!input.diameter || !input.height || input.diameter <= 0 || input.height <= 0) {
      return NextResponse.json(
        { error: '유효한 직경과 높이를 입력해주세요.' },
        { status: 400 }
      );
    }

    const { diameter, height, topHeadType = 'flat', bottomHeadType = 'flat', material = 'carbon' } = input;
    
    // 반지름 계산
    const radius = diameter / 2;
    
    // 원통 부피 계산 (π × r² × h)
    const cylinderVolume = Math.PI * Math.pow(radius, 2) * height;
    
    // 헤드 부피 계산 (현재는 flat head만 지원, 추후 확장 가능)
    let topHeadVolume = 0;
    let bottomHeadVolume = 0;
    
    if (topHeadType === 'elliptical') {
      // 타원형 헤드: (π × r² × h) / 3, h = r/4 (표준 2:1 타원형)
      topHeadVolume = (Math.PI * Math.pow(radius, 2) * (radius / 4)) / 3;
    } else if (topHeadType === 'hemispherical') {
      // 반구형 헤드: (2/3) × π × r³
      topHeadVolume = (2/3) * Math.PI * Math.pow(radius, 3);
    }
    
    if (bottomHeadType === 'elliptical') {
      bottomHeadVolume = (Math.PI * Math.pow(radius, 2) * (radius / 4)) / 3;
    } else if (bottomHeadType === 'hemispherical') {
      bottomHeadVolume = (2/3) * Math.PI * Math.pow(radius, 3);
    }
    
    // 총 부피 계산
    const totalVolume = cylinderVolume + topHeadVolume + bottomHeadVolume;
    
    // 무게 계산 (부피 × 밀도)
    const density = MATERIAL_DENSITIES[material as keyof typeof MATERIAL_DENSITIES] || MATERIAL_DENSITIES.carbon;
    const weight = totalVolume * density;
    
    // 공식 문자열 생성
    const formula = `V = π × r² × h + V_heads V = π × ${radius.toFixed(2)}² × ${height} + ${(topHeadVolume + bottomHeadVolume).toFixed(3)} V = ${totalVolume.toFixed(3)} m³ = ${(totalVolume * 1000).toFixed(1)} L`;
    
    const result: CalculationResult = {
      volume: totalVolume,
      weight: weight,
      unit: 'm³',
      formula: formula,
      inputs: {
        diameter,
        height,
        topHeadType,
        bottomHeadType,
        material,
        density: `${density} kg/m³`
      }
    };

    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Tank calculation error:', error);
    return NextResponse.json(
      { error: '탱크 부피 계산 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Tank Volume Calculation API',
    description: '탱크 부피 및 무게 계산 API',
    method: 'POST',
    parameters: {
      diameter: 'number (required) - 탱크 직경 (m)',
      height: 'number (required) - 탱크 높이 (m)', 
      topHeadType: 'string (optional) - 상부 헤드 타입 (flat, elliptical, hemispherical)',
      bottomHeadType: 'string (optional) - 하부 헤드 타입 (flat, elliptical, hemispherical)',
      material: 'string (optional) - 자재 타입 (carbon, stainless, aluminum, etc.)'
    }
  });
}