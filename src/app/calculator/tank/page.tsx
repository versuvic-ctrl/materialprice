'use client';

import React from 'react';
import TankCalculator from '@/components/calculator/TankCalculator';
import CalculatorLayout from '@/components/calculator/CalculatorLayout';

export default function TankCalculatorPage() {
  return (
    <CalculatorLayout
      title="Tank 부피 계산기"
      description="원통형 탱크의 부피와 무게를 계산합니다."
      icon={<span>🛢️</span>}
      visualizationComponent={<></>}
      resultComponent={<TankCalculator />}
    >
      {/* children 속성에 빈 프래그먼트를 명시적으로 전달합니다. */}
      <></>
    </CalculatorLayout>
  );
}