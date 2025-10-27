/**
 * calculator/page.tsx - 엔지니어링 계산기 페이지
 * 
 * 🎯 기능:
 * - 다양한 엔지니어링 계산기 제공 (Tank 부피, NPSH, 상사법칙, 펌프 동력 등)
 * - 각 탭별로 독립적인 컴포넌트로 구성
 * - 탭 기반 네비게이션
 * 
 * 🔗 연관 파일:
 * - components/calculator/TankCalculator.tsx: Tank 계산기
 * - components/calculator/NPSHCalculator.tsx: NPSH 계산기
 * - components/calculator/PumpPowerCalculator.tsx: 펌프 동력 계산기
 * 
 * ⭐ 중요도: ⭐⭐ 중요 - 엔지니어링 도구 제공
 */
'use client';

import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import TankCalculator from '@/components/calculator/TankCalculator';
import NPSHCalculator from '@/components/calculator/NPSHCalculator';
import PumpPowerCalculator from '@/components/calculator/PumpPowerCalculator';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type CalculatorType = 'tank' | 'npsh' | 'affinity' | 'pump-power' | 'flow' | 'heat-transfer' | 'valve' | 'efficiency' | 'vibration' | 'corrosion';

const calculatorTabs = [
  { value: 'tank', label: 'Tank 부피', icon: '🛢️' },
  { value: 'npsh', label: 'NPSH 계산', icon: '💧' },
  { value: 'affinity', label: '상사법칙', icon: '⚙️' },
  { value: 'pump-power', label: '펌프 계산', icon: '⚡' },
  { value: 'flow', label: '유량 계산', icon: '🌊' },
  { value: 'heat-transfer', label: '열전달', icon: '🔥' },
  { value: 'valve', label: '밸브 계산', icon: '🔧' },
  { value: 'efficiency', label: '효율 계산', icon: '⚡' },
  { value: 'vibration', label: '진동 해석', icon: '📳' },
  { value: 'corrosion', label: '부식 해석', icon: '🧪' },
];

export default function CalculatorPage() {
  const [activeTab, setActiveTab] = useState<CalculatorType>('tank');
  const isMobile = useIsMobile();

  // 각 계산기 컴포넌트를 렌더링하는 함수
  const renderCalculatorComponent = () => {
    switch (activeTab) {
      case 'tank':
        return <TankCalculator />;
      case 'npsh':
        return <NPSHCalculator />;
      case 'pump-power':
        return <PumpPowerCalculator />;
      case 'affinity':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              ⚙️
            </div>
            <h2 className="text-xl font-semibold mb-2">상사법칙 계산기</h2>
            <p className="text-gray-600 dark:text-gray-400">준비 중입니다.</p>
          </div>
        );
      case 'flow':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              🌊
            </div>
            <h2 className="text-xl font-semibold mb-2">유량 계산</h2>
            <p className="text-gray-600 dark:text-gray-400">준비 중입니다.</p>
          </div>
        );
      case 'heat-transfer':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              🔥
            </div>
            <h2 className="text-xl font-semibold mb-2">열전달</h2>
            <p className="text-gray-600 dark:text-gray-400">준비 중입니다.</p>
          </div>
        );
      case 'valve':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              🔧
            </div>
            <h2 className="text-xl font-semibold mb-2">밸브 계산</h2>
            <p className="text-gray-600 dark:text-gray-400">준비 중입니다.</p>
          </div>
        );
      case 'efficiency':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              ⚡
            </div>
            <h2 className="text-xl font-semibold mb-2">효율 계산</h2>
            <p className="text-gray-600 dark:text-gray-400">준비 중입니다.</p>
          </div>
        );
      case 'vibration':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              📳
            </div>
            <h2 className="text-xl font-semibold mb-2">진동 해석</h2>
            <p className="text-gray-600 dark:text-gray-400">준비 중입니다.</p>
          </div>
        );
      case 'corrosion':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              🧪
            </div>
            <h2 className="text-xl font-semibold mb-2">부식 해석</h2>
            <p className="text-gray-600 dark:text-gray-400">준비 중입니다.</p>
          </div>
        );
      default:
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              🧮
            </div>
            <h2 className="text-xl font-semibold mb-2">계산기 선택</h2>
            <p className="text-gray-600 dark:text-gray-400">위의 탭에서 원하는 계산기를 선택하세요.</p>
          </div>
        );
    }
  };

  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      <div className="space-y-2">
        {/* 계산기 탭 */}
        <div className="mb-6">
          {isMobile ? (
            <Select value={activeTab} onValueChange={(value) => setActiveTab(value as CalculatorType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="계산기 선택" />
              </SelectTrigger>
              <SelectContent>
                {calculatorTabs.map((tab) => (
                  <SelectItem key={tab.value} value={tab.value}>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{tab.icon}</span>
                      <h3 className="text-sm font-medium">{tab.label}</h3>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <>
              {/* 첫 번째 행 - 5개 탭 (모바일에서는 2-3열로 조정) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-2">
                {calculatorTabs.slice(0, 5).map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value as CalculatorType)}
                    className={`p-2 rounded-lg text-left transition-all duration-200 border ${
                      activeTab === tab.value
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{tab.icon}</span>
                      <h3 className="text-sm font-medium">{tab.label}</h3>
                    </div>
                  </button>
                ))}
              </div>

              {/* 두 번째 행 - 5개 탭 (모바일에서는 2-3열로 조정) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {calculatorTabs.slice(5).map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value as CalculatorType)}
                    className={`p-2 rounded-lg text-left transition-all duration-200 border ${
                      activeTab === tab.value
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{tab.icon}</span>
                      <h3 className="text-sm font-medium">{tab.label}</h3>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {/* 계산기 내용 */}
        <div>{renderCalculatorComponent()}</div>
      </div>
    </>
  );
}