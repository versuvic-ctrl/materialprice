import { NextRequest, NextResponse } from 'next/server';

interface AffinityCalculationInput {
  n1: number; // 초기 회전수 (rpm)
  n2: number; // 변경 회전수 (rpm)
  q1: number; // 초기 유량 (m³/h)
  h1: number; // 초기 양정 (m)
  p1: number; // 초기 동력 (kW)
}

interface CalculationResult {
  results?: {
    flow_rate: number;
    head: number;
    power: number;
  };
  units?: {
    flow_rate: string;
    head: string;
    power: string;
  };
  formulas?: {
    flow_rate: string;
    head: string;
    power: string;
  };
  inputs?: Record<string, number | string>;
}

export async function POST(request: NextRequest) {
  try {
    const input: AffinityCalculationInput = await request.json();
    
    // 입력값 검증
    if (
      typeof input.n1 !== 'number' || input.n1 <= 0 ||
      typeof input.n2 !== 'number' || input.n2 <= 0 ||
      typeof input.q1 !== 'number' || input.q1 <= 0 ||
      typeof input.h1 !== 'number' || input.h1 <= 0 ||
      typeof input.p1 !== 'number' || input.p1 <= 0
    ) {
      return NextResponse.json(
        { error: '모든 값은 0보다 큰 숫자여야 합니다.' },
        { status: 400 }
      );
    }

    const { n1, n2, q1, h1, p1 } = input;
    
    // 펌프 상사법칙 계산
    // Q2/Q1 = N2/N1 (유량은 회전수에 비례)
    // H2/H1 = (N2/N1)² (양정은 회전수의 제곱에 비례)
    // P2/P1 = (N2/N1)³ (동력은 회전수의 세제곱에 비례)
    
    const speedRatio = n2 / n1;
    
    const q2 = q1 * speedRatio;
    const h2 = h1 * Math.pow(speedRatio, 2);
    const p2 = p1 * Math.pow(speedRatio, 3);
    
    // 공식 문자열 생성
    const flowFormula = `Q₂ = Q₁ × (N₂/N₁) = ${q1} × (${n2}/${n1}) = ${q2.toFixed(2)} m³/h`;
    const headFormula = `H₂ = H₁ × (N₂/N₁)² = ${h1} × (${n2}/${n1})² = ${h2.toFixed(2)} m`;
    const powerFormula = `P₂ = P₁ × (N₂/N₁)³ = ${p1} × (${n2}/${n1})³ = ${p2.toFixed(2)} kW`;
    
    const result: CalculationResult = {
      results: {
        flow_rate: q2,
        head: h2,
        power: p2
      },
      units: {
        flow_rate: 'm³/h',
        head: 'm',
        power: 'kW'
      },
      formulas: {
        flow_rate: flowFormula,
        head: headFormula,
        power: powerFormula
      },
      inputs: {
        initial_speed: `${n1} rpm`,
        new_speed: `${n2} rpm`,
        initial_flow: `${q1} m³/h`,
        initial_head: `${h1} m`,
        initial_power: `${p1} kW`,
        speed_ratio: speedRatio.toFixed(3)
      }
    };

    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Affinity calculation error:', error);
    return NextResponse.json(
      { error: '상사법칙 계산 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Pump Affinity Laws Calculation API',
    description: '펌프 상사법칙 계산 API',
    method: 'POST',
    parameters: {
      n1: 'number (required) - 초기 회전수 (rpm)',
      n2: 'number (required) - 변경 회전수 (rpm)',
      q1: 'number (required) - 초기 유량 (m³/h)',
      h1: 'number (required) - 초기 양정 (m)',
      p1: 'number (required) - 초기 동력 (kW)'
    },
    formulas: {
      flow_rate: 'Q₂ = Q₁ × (N₂/N₁)',
      head: 'H₂ = H₁ × (N₂/N₁)²',
      power: 'P₂ = P₁ × (N₂/N₁)³'
    }
  });
}