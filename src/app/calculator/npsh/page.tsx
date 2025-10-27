'use client';

import React from 'react';
import NPSHCalculator from '@/components/calculator/NPSHCalculator';
import CalculatorLayout from '@/components/calculator/CalculatorLayout';

export default function NPSHCalculatorPage() {
  return (
    <CalculatorLayout
      title="NPSH 계산기"
      description="펌프의 순흡입수두/Net Positive Suction Head를 계산합니다."
      icon={<span>💧</span>}
      visualizationComponent={<></>}
      resultComponent={<NPSHCalculator />}
    >
      {/* children 속성에 빈 프래그먼트를 명시적으로 전달합니다. */}
      <></>
    </CalculatorLayout>
  );
}