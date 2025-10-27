'use client';

import React from 'react';
import PumpPowerCalculator from '@/components/calculator/PumpPowerCalculator';
import CalculatorLayout from '@/components/calculator/CalculatorLayout';

export default function PumpPowerCalculatorPage() {
  return (
    <CalculatorLayout
      title="펌프 동력 계산기"
      description="펌프의 동력을 계산합니다."
      icon={<span>⚡</span>}
      visualizationComponent={<></>}
      resultComponent={<PumpPowerCalculator />}
    >
      {/* children 속성에 빈 프래그먼트를 명시적으로 전달합니다. */}
      <></>
    </CalculatorLayout>
  );
}