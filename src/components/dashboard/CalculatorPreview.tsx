'use client';

import React, { useState } from 'react';
import {
  BookOpenIcon,
  CubeIcon,
  ScaleIcon,
  BeakerIcon,
  CalculatorIcon,
  ArrowTopRightOnSquareIcon,
  FireIcon,
  WrenchScrewdriverIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface CalculatorItem {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: 'volume' | 'pressure' | 'flow' | 'thermal' | 'mechanical';
  href: string;
  status: 'active' | 'coming-soon';
}

interface CalculatorPreviewProps {
  title?: string;
}

const CalculatorPreview: React.FC<CalculatorPreviewProps> = ({ title = '엔지니어링 계산기' }) => {
  const [quickCalcResult, setQuickCalcResult] = useState<number | null>(null);
  const [diameter, setDiameter] = useState<string>('');
  const [height, setHeight] = useState<string>('');

  const calculators: CalculatorItem[] = [
    {
      id: '1',
      name: 'Tank 부피',
      description: '원통형 탱크의 부피를 계산합니다',
      emoji: '🛢️',
      category: 'volume',
      href: '/calculator/tank',
      status: 'active'
    },
    {
      id: '2',
      name: 'NPSH 계산',
      description: '펌프의 NPSH를 계산합니다',
      emoji: '💧',
      category: 'pressure',
      href: '/calculator/npsh',
      status: 'active'
    },
    {
      id: '3',
      name: '펌프 계산',
      description: '펌프 동력 및 효율을 계산합니다',
      emoji: '⚡',
      category: 'mechanical',
      href: '/calculator/pump-power',
      status: 'active'
    },
    {
      id: '4',
      name: '상사법칙',
      description: '펌프 친화 법칙을 적용한 계산',
      emoji: '⚙️',
      category: 'mechanical',
      href: '/calculator',
      status: 'coming-soon'
    },
    {
      id: '5',
      name: '유량 계산',
      description: '배관 유량을 계산합니다',
      emoji: '🌊',
      category: 'flow',
      href: '/calculator',
      status: 'coming-soon'
    },
    {
      id: '6',
      name: '열전달',
      description: '열전달 계수를 계산합니다',
      emoji: '🔥',
      category: 'thermal',
      href: '/calculator',
      status: 'coming-soon'
    }
  ];

  const getCategoryColor = (category: CalculatorItem['category']) => {
    const colors = {
      volume: 'bg-blue-100 text-blue-800',
      pressure: 'bg-purple-100 text-purple-800',
      flow: 'bg-cyan-100 text-cyan-800',
      thermal: 'bg-orange-100 text-orange-800',
      mechanical: 'bg-green-100 text-green-800'
    };
    return colors[category];
  };

  const getCategoryLabel = (category: CalculatorItem['category']) => {
    const labels = {
      volume: '부피',
      pressure: '압력',
      flow: '유량',
      thermal: '열역학',
      mechanical: '기계'
    };
    return labels[category];
  };

  const calculateTankVolume = () => {
    const d = parseFloat(diameter);
    const h = parseFloat(height);
    
    if (d > 0 && h > 0) {
      const radius = d / 2;
      const volume = Math.PI * radius * radius * h;
      setQuickCalcResult(volume);
    } else {
      setQuickCalcResult(null);
    }
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(2)} m³`;
    }
    return `${volume.toFixed(2)} L`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
            <CalculatorIcon className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        
        <Link 
          href="/calculator"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1 self-start sm:self-auto"
        >
          <span>전체보기</span>
          <ArrowTopRightOnSquareIcon className="w-4 h-4" />
        </Link>
      </div>



      {/* Calculator List - 간소화 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 flex-grow">
        {calculators.map((calc) => {
          return (
            <Link
              key={calc.id}
              href={calc.href}
              className={`group p-3 rounded-lg border transition-all duration-200 flex flex-col min-h-[100px] ${
                calc.status === 'coming-soon' 
                  ? 'border-gray-100 bg-gray-50 cursor-not-allowed' 
                  : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
              }`}
              onClick={calc.status === 'coming-soon' ? (e) => e.preventDefault() : undefined}
            >
              {/* 아이콘 */}
              <div className="text-2xl mb-2">{calc.emoji}</div>
              
              {/* 텍스트 영역 */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h4 className={`text-sm font-medium mb-1 line-clamp-1 ${
                    calc.status === 'coming-soon' 
                      ? 'text-gray-400' 
                      : 'text-gray-900 group-hover:text-blue-600'
                  }`}>
                    {calc.name}
                  </h4>
                  <p className={`text-xs mb-2 line-clamp-2 ${
                    calc.status === 'coming-soon' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {calc.description}
                  </p>
                </div>
                <div className="flex items-center justify-between">

                  {calc.status === 'coming-soon' && (
                    <span className="text-xs text-gray-400">준비중</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer - 간소화 */}
      <div className="pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>총 {calculators.length}개 계산기</span>
        </div>
      </div>
    </div>
  );
};

export default CalculatorPreview;