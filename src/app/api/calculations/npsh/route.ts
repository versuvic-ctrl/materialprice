import { NextRequest, NextResponse } from 'next/server';

interface NPSHCalculationInput {
  atmospheric_pressure: number;
  vapor_pressure: number;
  static_head: number;
  friction_loss: number;
}

interface CalculationResult {
  npsh?: number;
  unit?: string;
  formula?: string;
  inputs?: Record<string, number | string>;
}

export async function POST(request: NextRequest) {
  try {
    const input: NPSHCalculationInput = await request.json();
    
    // 입력값 검증
    if (
      typeof input.atmospheric_pressure !== 'number' ||
      typeof input.vapor_pressure !== 'number' ||
      typeof input.static_head !== 'number' ||
      typeof input.friction_loss !== 'number'
    ) {
      return NextResponse.json(
        { error: '모든 압력 및 헤드 값을 올바르게 입력해주세요.' },
        { status: 400 }
      );
    }

    const { atmospheric_pressure, vapor_pressure, static_head, friction_loss } = input;
    
    // NPSH 계산: NPSH = (Pa - Pv) / ρg + Hs - Hf
    // 여기서는 간단히 압력 헤드로 계산
    // Pa: 대기압 (kPa), Pv: 증기압 (kPa), Hs: 정적 헤드 (m), Hf: 마찰 손실 (m)
    
    // 압력을 헤드로 변환 (1 kPa ≈ 0.102 m H2O)
    const pressureHead = (atmospheric_pressure - vapor_pressure) * 0.102;
    
    // NPSH 계산
    const npsh = pressureHead + static_head - friction_loss;
    
    // 공식 문자열 생성
    const formula = `NPSH = (Pa - Pv) / ρg + Hs - Hf
NPSH = (${atmospheric_pressure} - ${vapor_pressure}) × 0.102 + ${static_head} - ${friction_loss}
NPSH = ${npsh.toFixed(2)} m`;
    
    const result: CalculationResult = {
      npsh: npsh,
      unit: 'm',
      formula: formula,
      inputs: {
        atmospheric_pressure: `${atmospheric_pressure} kPa`,
        vapor_pressure: `${vapor_pressure} kPa`,
        static_head: `${static_head} m`,
        friction_loss: `${friction_loss} m`,
        pressure_head: `${pressureHead.toFixed(2)} m`
      }
    };

    return NextResponse.json(result);
    
  } catch (error) {
    console.error('NPSH calculation error:', error);
    return NextResponse.json(
      { error: 'NPSH 계산 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'NPSH Calculation API',
    description: 'Net Positive Suction Head 계산 API',
    method: 'POST',
    parameters: {
      atmospheric_pressure: 'number (required) - 대기압 (kPa)',
      vapor_pressure: 'number (required) - 증기압 (kPa)',
      static_head: 'number (required) - 정적 헤드 (m)',
      friction_loss: 'number (required) - 마찰 손실 (m)'
    },
    formula: 'NPSH = (Pa - Pv) / ρg + Hs - Hf'
  });
}