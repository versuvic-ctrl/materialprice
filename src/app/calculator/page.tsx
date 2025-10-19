/**
 * calculator/page.tsx - 엔지니어링 계산기 페이지
 * 
 * 🎯 기능:
 * - 다양한 엔지니어링 계산기 제공 (Tank 부피, NPSH, 상사법칙 등)
 * - 3D 시각화 컴포넌트 (Tank, Pump 모델)
 * - 실시간 계산 결과 표시
 * - 계산 공식 및 설명 제공
 * 
 * 🔗 연관 파일:
 * - lib/api.ts: 계산 로직 API 함수들
 * - components/TankVisualization.tsx: Tank 3D 모델
 * - components/PumpVisualization.tsx: Pump 3D 모델
 * 
 * ⭐ 중요도: ⭐⭐ 중요 - 엔지니어링 도구 제공
 * 
 * 🧮 계산기 종류:
 * - Tank 부피/무게 계산
 * - NPSH (Net Positive Suction Head) 계산
 * - 펌프 상사법칙 계산
 * - 압력, 유량, 열전달 등 (개발 예정)
 */
'use client';

import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Calculator, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { calculateTankVolumeExport, calculateNPSHExport, calculateAffinityExport, CalculationResult } from '@/lib/api';
import dynamic from 'next/dynamic';
import Layout from '@/components/layout/Layout';

// Tank 3D 시각화 컴포넌트 (동적 로딩)
// SSR 비활성화로 클라이언트에서만 렌더링
const TankVisualization = dynamic(() => import('@/components/calculator/TankVisualization'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      3D 모델 로딩 중...
    </div>
  )
});

// Pump 3D 시각화 컴포넌트 (동적 로딩)
// SSR 비활성화로 클라이언트에서만 렌더링
const PumpVisualization = dynamic(() => import('@/components/calculator/PumpVisualization'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      펌프 3D 모델 로딩 중...
    </div>
  )
});

type TankHeadType = 'flat' | 'elliptical' | 'hemispherical';
const TANK_HEAD_TYPES: TankHeadType[] = ['flat', 'elliptical', 'hemispherical'];

export default function CalculatorPage() {
  // 선택된 계산기 타입 상태
  const [selectedCalculator, setSelectedCalculator] = useState<string>('');
  // 계산 진행 중 로딩 상태
  const [isLoading, setIsLoading] = useState(false);
  // 계산 결과 저장 상태
  const [result, setResult] = useState<CalculationResult | null>(null);
  
  // Tank 계산기 입력값 상태
  const [tankInputs, setTankInputs] = useState({
  density: 7850,
    thickness: '10',           // 두께 (mm)
      diameter: '',           // 직경 (m)
    height: '',            // 높이 (m)
    topHeadType: 'flat',   // 상부 헤드 타입
    bottomHeadType: 'flat', // 하부 헤드 타입
    material: 'carbon', // 재질 (기본값: Carbon Steel)
  });
  
  // NPSH 계산기 입력값 상태
  const [npshInputs, setNpshInputs] = useState({
    atmosphericPressure: '', // 대기압 (kPa)
    vaporPressure: '',      // 증기압 (kPa)
    staticHead: '',         // 정적 수두 (m)
    frictionLoss: ''        // 마찰 손실 (m)
  });
  
  // 상사법칙 계산기 입력값 상태
  const [affinityInputs, setAffinityInputs] = useState({
    q1: '', // 기존 유량 (m³/h)
    h1: '', // 기존 양정 (m)
    p1: '', // 기존 동력 (kW)
    n1: '', // 기존 회전수 (rpm)
    n2: ''  // 새 회전수 (rpm)
  });

  const [npshResult, setNpshResult] = useState<{
    npsha: number;
    flowRate: number;
    head: number;
    power: number;
    speed: number;
  } | null>({
    npsha: 5,
    flowRate: 100,
    head: 50,
    power: 15,
    speed: 1750,
  });

  // 선택된 계산기에 따라 해당 계산 함수를 호출하는 핸들러
  const handleCalculate = async () => {
    setIsLoading(true);
    try {
      let calculationResult;
      
      // Tank 부피/무게 계산
      if (selectedCalculator === 'tank') {
        const diameter = parseFloat(tankInputs.diameter);
        const height = parseFloat(tankInputs.height);

        if (isNaN(diameter) || diameter <= 0) {
          toast.error('유효한 직경을 입력해주세요.');
          return;
        }
        if (isNaN(height) || height <= 0) {
          toast.error('유효한 높이를 입력해주세요.');
          return;
        }

        calculationResult = await calculateTankVolumeExport({
          diameter: diameter,
          height: height,
          topHeadType: tankInputs.topHeadType,
          bottomHeadType: tankInputs.bottomHeadType,
          material: tankInputs.material
        });
      } 
      // NPSH 계산
      else if (selectedCalculator === 'npsh') {
        calculationResult = await calculateNPSHExport({
          atmospheric_pressure: parseFloat(npshInputs.atmosphericPressure),
          vapor_pressure: parseFloat(npshInputs.vaporPressure),
          static_head: parseFloat(npshInputs.staticHead),
          friction_loss: parseFloat(npshInputs.frictionLoss)
        });
      } 
      // 펌프 상사법칙 계산
      else if (selectedCalculator === 'affinity') {
        calculationResult = await calculateAffinityExport({
          q1: parseFloat(affinityInputs.q1),
          h1: parseFloat(affinityInputs.h1),
          p1: parseFloat(affinityInputs.p1),
          n1: parseFloat(affinityInputs.n1),
          n2: parseFloat(affinityInputs.n2)
        });
      }
      
      setResult(calculationResult || null);
    } catch (error) {
      console.error('계산 오류:', error);
      alert('계산 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 선택된 계산기에 따라 해당 입력 폼을 렌더링하는 함수
  const renderCalculatorInputs = () => {
    // 개발 예정인 계산기 목록
    const developmentCalculators = ['pressure', 'flow', 'heat', 'pipe', 'valve', 'stress', 'vibration'];
    
    if (developmentCalculators.includes(selectedCalculator)) {
      return (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            🚧
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            개발중
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            이 계산기는 현재 개발 중입니다.
          </p>
        </div>
      );
    }
    
    if (selectedCalculator === 'tank') {
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                직경 (m)
              </label>
              <input
                type="number"
                value={tankInputs.diameter}
                onChange={(e) => setTankInputs({...tankInputs, diameter: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="예: 3.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                높이 (m)
              </label>
              <input
                type="number"
                value={tankInputs.height}
                onChange={(e) => setTankInputs({...tankInputs, height: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="예: 5.0"
              />
            </div>
          </div>
            <div className="flex space-x-4">
              <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  상부 헤드 타입
                </label>
                <select
                  value={tankInputs.topHeadType}
                  onChange={(e) => setTankInputs({...tankInputs, topHeadType: e.target.value as TankHeadType})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  {TANK_HEAD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  하부 헤드 타입
                </label>
                <select
                  value={tankInputs.bottomHeadType}
                  onChange={(e) => setTankInputs({...tankInputs, bottomHeadType: e.target.value as TankHeadType})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  {TANK_HEAD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              재질
            </label>
            <select
              title="재질 선택"
              value={tankInputs.material}
              onChange={(e) => {
                const newMaterial = e.target.value;
                let newDensity = 0;
                if (newMaterial === 'carbon') {
                  newDensity = 7850;
                } else if (newMaterial === 'stainless') {
                  newDensity = 8000;
                } else if (newMaterial === 'aluminum') {
                  newDensity = 2700;
                }
                setTankInputs({...tankInputs, material: newMaterial, density: newDensity});
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="carbon">Carbon Steel</option>
              <option value="stainless">Stainless Steel</option>
              <option value="aluminum">Aluminum</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              두께 (mm)
            </label>
            <input
              type="number"
              value={tankInputs.thickness}
              onChange={(e) => setTankInputs({...tankInputs, thickness: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="예: 10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              밀도 (kg/m³)
            </label>
            <input
              type="number"
              value={tankInputs.density}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-gray-100 dark:bg-gray-600 cursor-not-allowed"
            />
          </div>
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              계산 공식
            </h4>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p><strong>원통부 무게:</strong> W_shell = π × D × H × t × ρ</p>
              <p><strong>헤드부 무게:</strong> W_head = 2 × (π × D² / 4) × t × ρ × k</p>
              <p><strong>총 무게:</strong> W_total = W_shell + W_head</p>
              <p className="text-xs mt-2">
                D: 직경, H: 높이, t: 두께, ρ: 밀도, k: 헤드 계수
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    if (selectedCalculator === 'npsh') {
      return (
        <div className='space-y-2'>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
              액체 표면-펌프 높이 차 (m)
              <small className='text-gray-500 dark:text-gray-400 ml-1'>(펌프보다 액체가 높으면 양수)</small>
            </label>
            <input
              type='number'
              value={npshInputs.staticHead}
              onChange={(e) => setNpshInputs({...npshInputs, staticHead: e.target.value})}
              className='w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700'
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              대기압 (kPa)
            </label>
            <input
              type="number"
              value={npshInputs.atmosphericPressure}
              onChange={(e) => setNpshInputs({...npshInputs, atmosphericPressure: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="예: 101.325"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              증기압 (kPa)
            </label>
            <input
              type="number"
              value={npshInputs.vaporPressure}
              onChange={(e) => setNpshInputs({...npshInputs, vaporPressure: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="예: 2.339"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              정적 수두 (m)
            </label>
            <input
              type="number"
              value={npshInputs.staticHead}
              onChange={(e) => setNpshInputs({...npshInputs, staticHead: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="예: 5.0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              마찰 손실 (m)
            </label>
            <input
              type="number"
              value={npshInputs.frictionLoss}
              onChange={(e) => setNpshInputs({...npshInputs, frictionLoss: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="예: 1.5"
            />
          </div>
          <div className="mt-6 p-4 bg-green-50 dark:bg-green-900 dark:bg-opacity-20 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              계산 공식
            </h4>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p><strong>NPSHA = (Pa - Pv) / (ρ × g) + Hs - Hf</strong></p>
              <p className="text-xs mt-2">
                Pa: 대기압, Pv: 증기압, ρ: 밀도, g: 중력가속도, Hs: 정적수두, Hf: 마찰손실
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    if (selectedCalculator === 'affinity') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                기존 유량 (m³/h)
              </label>
              <input
                type="number"
                value={affinityInputs.q1}
                onChange={(e) => setAffinityInputs({...affinityInputs, q1: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                기존 양정 (m)
              </label>
              <input
                type="number"
                value={affinityInputs.h1}
                onChange={(e) => setAffinityInputs({...affinityInputs, h1: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                기존 동력 (kW)
              </label>
              <input
                type="number"
                value={affinityInputs.p1}
                onChange={(e) => setAffinityInputs({...affinityInputs, p1: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="15"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                기존 회전수 (rpm)
              </label>
              <input
                type="number"
                value={affinityInputs.n1}
                onChange={(e) => setAffinityInputs({...affinityInputs, n1: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="1450"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              새 회전수 (rpm)
            </label>
            <input
              type="number"
              value={affinityInputs.n2}
              onChange={(e) => setAffinityInputs({...affinityInputs, n2: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="예: 1000"
            />
          </div>
          <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900 dark:bg-opacity-20 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              계산 공식
            </h4>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p><strong>유량:</strong> Q₂ = Q₁ × (N₂ / N₁)</p>
              <p><strong>양정:</strong> H₂ = H₁ × (N₂ / N₁)²</p>
              <p><strong>동력:</strong> P₂ = P₁ × (N₂ / N₁)³</p>
              <p className="text-xs mt-2">N₁: 기존 회전수, N₂: 새 회전수</p>
            </div>
          </div>
        </div>
      );
    }
    
    return null;
  };

  return (
    <>
      <Toaster />
      <div className="container mx-auto p-4">
        {/* 상단 계산기 탭 버튼 (2줄 x 5열) */}
        <div className="mb-4">
          <div className="grid grid-cols-5 gap-2">
            {/* 첫 번째 줄 */}
            <button
               onClick={() => setSelectedCalculator('tank')}
               className={`p-2 rounded-lg text-left transition-all duration-200 ${
                 selectedCalculator === 'tank'
                   ? 'bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border-2 border-blue-200 dark:border-blue-700'
                   : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
               }`}
             >
               <div className="flex items-center space-x-2">
                 <span className="text-lg">🛢️</span>
                 <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                   Tank 부피
                 </h3>
               </div>
             </button>
            
            <button
               onClick={() => setSelectedCalculator('npsh')}
               className={`p-2 rounded-lg text-left transition-all duration-200 ${
                 selectedCalculator === 'npsh'
                   ? 'bg-green-50 dark:bg-green-900 dark:bg-opacity-20 border-2 border-green-200 dark:border-green-700'
                   : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
               }`}
             >
               <div className="flex items-center space-x-2">
                 <span className="text-lg">💧</span>
                 <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                   NPSH 계산
                 </h3>
               </div>
             </button>
            
            <button
               onClick={() => setSelectedCalculator('affinity')}
               className={`p-2 rounded-lg text-left transition-all duration-200 ${
                 selectedCalculator === 'affinity'
                   ? 'bg-purple-50 dark:bg-purple-900 dark:bg-opacity-20 border-2 border-purple-200 dark:border-purple-700'
                   : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
               }`}
             >
               <div className="flex items-center space-x-2">
                 <span className="text-lg">⚙️</span>
                 <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                   상사법칙
                 </h3>
               </div>
             </button>
            
            <button
               onClick={() => setSelectedCalculator('pressure')}
               className={`p-2 rounded-lg text-left transition-all duration-200 ${
                 selectedCalculator === 'pressure'
                   ? 'bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border-2 border-red-200 dark:border-red-700'
                   : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
               }`}
             >
               <div className="flex items-center space-x-2">
                 <span className="text-lg">📊</span>
                 <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                   압력 계산
                 </h3>
               </div>
             </button>
            
            <button
               onClick={() => setSelectedCalculator('flow')}
               className={`p-2 rounded-lg text-left transition-all duration-200 ${
                 selectedCalculator === 'flow'
                   ? 'bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border-2 border-yellow-200 dark:border-yellow-700'
                   : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
               }`}
             >
               <div className="flex items-center space-x-2">
                 <span className="text-lg">🌊</span>
                 <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                   유량 계산
                 </h3>
               </div>
             </button>
            
            {/* 두 번째 줄 */}
            <button
               onClick={() => setSelectedCalculator('heat')}
               className={`p-2 rounded-lg text-left transition-all duration-200 ${
                 selectedCalculator === 'heat'
                   ? 'bg-orange-50 dark:bg-orange-900 dark:bg-opacity-20 border-2 border-orange-200 dark:border-orange-700'
                   : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
               }`}
             >
               <div className="flex items-center space-x-2">
                 <span className="text-lg">🔥</span>
                 <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                   열전달
                 </h3>
               </div>
             </button>
            
            <button
               onClick={() => setSelectedCalculator('pipe')}
               className={`p-2 rounded-lg text-left transition-all duration-200 ${
                 selectedCalculator === 'pipe'
                   ? 'bg-indigo-50 dark:bg-indigo-900 dark:bg-opacity-20 border-2 border-indigo-200 dark:border-indigo-700'
                   : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
               }`}
             >
               <div className="flex items-center space-x-2">
                 <span className="text-lg">🔧</span>
                 <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                   배관 설계
                 </h3>
               </div>
             </button>
            
            <button
               onClick={() => setSelectedCalculator('valve')}
               className={`p-2 rounded-lg text-left transition-all duration-200 ${
                 selectedCalculator === 'valve'
                   ? 'bg-teal-50 dark:bg-teal-900 dark:bg-opacity-20 border-2 border-teal-200 dark:border-teal-700'
                   : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
               }`}
             >
               <div className="flex items-center space-x-2">
                 <span className="text-lg">🎛️</span>
                 <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                   밸브 계산
                 </h3>
               </div>
             </button>
            
            <button
               onClick={() => setSelectedCalculator('stress')}
               className={`p-2 rounded-lg text-left transition-all duration-200 ${
                 selectedCalculator === 'stress'
                   ? 'bg-pink-50 dark:bg-pink-900 dark:bg-opacity-20 border-2 border-pink-200 dark:border-pink-700'
                   : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
               }`}
             >
               <div className="flex items-center space-x-2">
                 <span className="text-lg">⚡</span>
                 <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                   응력 해석
                 </h3>
               </div>
             </button>
            
            <button
               onClick={() => setSelectedCalculator('vibration')}
               className={`p-2 rounded-lg text-left transition-all duration-200 ${
                 selectedCalculator === 'vibration'
                   ? 'bg-cyan-50 dark:bg-cyan-900 dark:bg-opacity-20 border-2 border-cyan-200 dark:border-cyan-700'
                   : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
               }`}
             >
               <div className="flex items-center space-x-2">
                 <span className="text-lg">📳</span>
                 <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                   진동 해석
                 </h3>
               </div>
             </button>
          </div>
        </div>
        
        <div className="flex gap-6">
          
          {/* 우측 메인 컨텐츠 */}
          <div className="flex-1">
            {!selectedCalculator ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  🧮
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  계산기를 선택하세요
                </h2>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                {/* 계산기 입력 및 시각화 */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                  {/* 입력 영역 */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        입력 값
                      </h3>
                      <button
                        onClick={() => {
                          setSelectedCalculator('');
                          setResult(null);
                        }}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        ✕
                      </button>
                    </div>
                    
                    <div className="max-h-[400px] overflow-y-auto">
                      {renderCalculatorInputs()}
                    </div>
                    
                    <button
                      onClick={handleCalculate}
                      disabled={isLoading}
                      className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          계산 중...
                        </>
                      ) : (
                        <>
                          <Calculator className="w-4 h-4 mr-2" />
                          계산하기
                        </>
                      )}
                    </button>
                  </div>
                  
                  {/* 3D 시각화 영역 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      {selectedCalculator === 'tank' ? 'Tank 3D 시각화' : 
                        (selectedCalculator === 'npsh' || selectedCalculator === 'affinity') ? '펌프 3D 시각화' : '3D 시각화'}
                    </h3>
                    {selectedCalculator === 'tank' && (
                      <div className="h-96">
                        <TankVisualization
                          diameter={parseFloat(tankInputs.diameter) || 3.0}
                          height={parseFloat(tankInputs.height) || 5.0}
                          topHeadType={tankInputs.topHeadType}
                          bottomHeadType={tankInputs.bottomHeadType}
                        />
                      </div>
                    )}
                    {(selectedCalculator === 'npsh' || selectedCalculator === 'affinity') && npshResult && (
                       <div className="h-96">
                         <PumpVisualization
                           flowRate={npshResult.flowRate}
                           head={npshResult.head}
                           power={npshResult.power}
                           speed={npshResult.speed}
                           npshAvailable={npshResult.npsha}
                         />
                       </div>
                    )}
                     {!['tank', 'npsh', 'affinity'].includes(selectedCalculator) && (
                       <div className="h-96 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                         <div className="text-center">
                           <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-3">
                             🚧
                           </div>
                           <p className="text-gray-500 dark:text-gray-400">
                             3D 시각화 개발중
                           </p>
                         </div>
                       </div>
                     )}
                  </div>
                </div>
                
                {/* 계산 결과 */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    계산 결과
                  </h3>
                  {result ? (
                    <div className="space-y-6">
                      {/* 주요 결과 표시 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {result.volume && (
                          <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                            <div className="text-sm text-blue-600 dark:text-blue-400 mb-1 font-medium">
                              부피
                            </div>
                            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                              {result.volume.toFixed(2)} m³
                            </div>
                            <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                              = {(result.volume * 1000).toFixed(1)} L
                            </div>
                          </div>
                        )}
                        
                        {result.weight && (
                          <div className="bg-green-50 dark:bg-green-900 dark:bg-opacity-20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                            <div className="text-sm text-green-600 dark:text-green-400 mb-1 font-medium">
                              무게
                            </div>
                            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                              {result.weight.toFixed(2)} kg
                            </div>
                          </div>
                        )}
                        
                        {result.npsh && (
                          <div className="bg-purple-50 dark:bg-purple-900 dark:bg-opacity-20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                            <div className="text-sm text-purple-600 dark:text-purple-400 mb-1 font-medium">
                              NPSH
                            </div>
                            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                              {result.npsh.toFixed(2)} m
                            </div>
                          </div>
                        )}
                        
                        {result.results && (
                          <>
                            <div className="bg-orange-50 dark:bg-orange-900 dark:bg-opacity-20 p-4 rounded-lg border border-orange-200 dark:border-orange-700">
                              <div className="text-sm text-orange-600 dark:text-orange-400 mb-1 font-medium">
                                새 유량
                              </div>
                              <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                                {result.results.flow_rate.toFixed(2)} m³/h
                              </div>
                            </div>
                            
                            <div className="bg-red-50 dark:bg-red-900 dark:bg-opacity-20 p-4 rounded-lg border border-red-200 dark:border-red-700">
                              <div className="text-sm text-red-600 dark:text-red-400 mb-1 font-medium">
                                새 양정
                              </div>
                              <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                                {result.results.head.toFixed(2)} m
                              </div>
                            </div>
                            
                            <div className="bg-indigo-50 dark:bg-indigo-900 dark:bg-opacity-20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700">
                              <div className="text-sm text-indigo-600 dark:text-indigo-400 mb-1 font-medium">
                                새 동력
                              </div>
                              <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                                {result.results.power.toFixed(2)} kW
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {/* 계산 공식 표시 */}
                      {result.formula && (
                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            계산 공식
                          </h4>
                          <div className="text-sm text-gray-600 dark:text-gray-400 font-mono bg-white dark:bg-gray-800 p-3 rounded border">
                            {result.formula}
                          </div>
                        </div>
                      )}
                      
                      {/* 상사법칙 공식들 표시 */}
                      {result.formulas && (
                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            펌프 상사법칙 공식
                          </h4>
                          <div className="space-y-2">
                            <div className="text-sm text-gray-600 dark:text-gray-400 font-mono bg-white dark:bg-gray-800 p-2 rounded border">
                              <span className="text-orange-600 dark:text-orange-400 font-medium">유량:</span> {result.formulas.flow_rate}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 font-mono bg-white dark:bg-gray-800 p-2 rounded border">
                              <span className="text-red-600 dark:text-red-400 font-medium">양정:</span> {result.formulas.head}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 font-mono bg-white dark:bg-gray-800 p-2 rounded border">
                              <span className="text-indigo-600 dark:text-indigo-400 font-medium">동력:</span> {result.formulas.power}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* 입력값 요약 */}
                      {result.inputs && (
                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            입력값 요약
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {Object.entries(result.inputs).map(([key, value]) => (
                              <div key={key} className="bg-white dark:bg-gray-800 p-2 rounded border">
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                  {key === 'diameter' && '직경'}
                                  {key === 'height' && '높이'}
                                  {key === 'material' && '재질'}
                                  {key === 'topHeadType' && '상부헤드'}
                                  {key === 'bottomHeadType' && '하부헤드'}
                                  {key === 'density' && '밀도'}
                                  {key === 'atmospheric_pressure' && '대기압'}
                                  {key === 'vapor_pressure' && '증기압'}
                                  {key === 'static_head' && '정압'}
                                  {key === 'friction_loss' && '마찰손실'}
                                  {key === 'q1' && '기존유량'}
                                  {key === 'h1' && '기존양정'}
                                  {key === 'p1' && '기존동력'}
                                  {key === 'n1' && '기존회전수'}
                                  {key === 'n2' && '새회전수'}
                                  {!['diameter', 'height', 'material', 'topHeadType', 'bottomHeadType', 'density', 'atmospheric_pressure', 'vapor_pressure', 'static_head', 'friction_loss', 'q1', 'h1', 'p1', 'n1', 'n2'].includes(key) && key}
                                </div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white break-words">
                                  {typeof value === 'string' && value.length > 15 ? 
                                    `${value.substring(0, 15)}...` : 
                                    String(value)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 dark:text-gray-400">
                        계산 결과가 여기에 표시됩니다
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}