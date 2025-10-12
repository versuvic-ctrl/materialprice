'use client';

import React, { useState } from 'react';
import {
  CalculatorIcon,
  CubeIcon,
  ScaleIcon,
  BeakerIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface CalculatorItem {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'volume' | 'weight' | 'pressure' | 'thermal';
  href: string;
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
      name: 'Tank 부피 계산',
      description: '원통형 탱크의 부피를 계산합니다',
      icon: CubeIcon,
      category: 'volume',
      href: '/calculator'
    },
    {
      id: '2',
      name: '강재 중량 계산',
      description: '다양한 형태의 강재 중량을 계산합니다',
      icon: ScaleIcon,
      category: 'weight',
      href: '/calculator'
    },
    {
      id: '3',
      name: 'NPSH 계산',
      description: '펌프의 NPSH를 계산합니다',
      icon: BeakerIcon,
      category: 'pressure',
      href: '/calculator'
    },
    {
      id: '4',
      name: 'Affinity Law',
      description: '펌프 친화 법칙을 적용한 계산',
      icon: CalculatorIcon,
      category: 'pressure',
      href: '/calculator'
    }
  ];

  const getCategoryColor = (category: CalculatorItem['category']) => {
    const colors = {
      volume: 'bg-blue-100 text-blue-800',
      weight: 'bg-green-100 text-green-800',
      pressure: 'bg-purple-100 text-purple-800',
      thermal: 'bg-orange-100 text-orange-800'
    };
    return colors[category];
  };

  const getCategoryLabel = (category: CalculatorItem['category']) => {
    const labels = {
      volume: '부피',
      weight: '중량',
      pressure: '압력',
      thermal: '열역학'
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-2">
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
          <ArrowRightIcon className="w-4 h-4" />
        </Link>
      </div>

      {/* Quick Calculator */}
      <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
        <h4 className="text-sm font-medium text-gray-900 mb-3">빠른 계산 - Tank 부피</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              직경 (m)
            </label>
            <input
              type="number"
              value={diameter}
              onChange={(e) => setDiameter(e.target.value)}
              onInput={calculateTankVolume}
              placeholder="3.0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              높이 (m)
            </label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              onInput={calculateTankVolume}
              placeholder="5.0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        {quickCalcResult !== null && (
          <div className="bg-white rounded-md p-3 border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">계산 결과:</span>
              <span className="text-lg font-bold text-blue-600">
                {formatVolume(quickCalcResult)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Calculator List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        {calculators.map((calc) => {
          const Icon = calc.icon;
          
          return (
            <Link
              key={calc.id}
              href={calc.href}
              className="group p-2 sm:p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-200"
            >
              <div className="flex items-start space-x-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-100 group-hover:bg-blue-100 rounded-lg flex items-center justify-center transition-colors">
                  <Icon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 group-hover:text-blue-600" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="text-xs sm:text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                      {calc.name}
                    </h4>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(calc.category)}`}>
                      {getCategoryLabel(calc.category)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2 truncate">
                    {calc.description}
                  </p>
                </div>
                
                <ArrowRightIcon className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Popular Formulas */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">자주 사용하는 공식</h4>
        <div className="flex flex-wrap gap-2">
          {[
            'Tank Volume: π × r² × h',
            'Steel Weight: Volume × Density',
            'NPSH: (P₁ - Pᵥ) / ρg + V₁²/2g',
            'Affinity Law: Q₂/Q₁ = N₂/N₁'
          ].map((formula, index) => (
            <div
              key={index}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono bg-gray-100 text-gray-700"
            >
              {formula}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>총 {calculators.length}개 계산기</span>
          <span>단위: SI 기준</span>
        </div>
      </div>
    </div>
  );
};

export default CalculatorPreview;