'use client';

import React, { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface CalculatorLayoutProps {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  visualizationComponent: ReactNode;
  resultComponent: ReactNode;
}

export default function CalculatorLayout({
  title,
  description,
  icon,
  children,
  visualizationComponent,
  resultComponent,
}: CalculatorLayoutProps) {
  const router = useRouter();

  return (
    <div className="container mx-auto p-4">
      {/* 네비게이션 헤더 */}
      <div className="mb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {icon} {title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {description}
            </p>
          </div>

          <button
            onClick={() => router.push('/calculator')}
            className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium py-1 px-3 rounded-lg flex items-center gap-2 transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="text-sm">뒤로가기</span>
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="grid grid-cols-1 gap-3">
        {/* 좌측: 입력 조건 */}
        <div>
            {children}
        </div>

        {/* 우측: 3D 시각화 및 계산 결과 */}
        <div className="space-y-6">
            {visualizationComponent}
            {resultComponent}
        </div>
      </div>
    </div>
  );
}