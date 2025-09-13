'use client';

import { useState } from 'react';
import { Calculator, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { calculateTankVolume, calculateNPSH, calculateAffinity, CalculationResult } from '@/lib/api';
import dynamic from 'next/dynamic';
import Layout from '@/components/layout/Layout';

const TankVisualization = dynamic(() => import('@/components/TankVisualization'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      3D 모델 로딩 중...
    </div>
  )
});

const PumpVisualization = dynamic(() => import('@/components/PumpVisualization'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      펌프 3D 모델 로딩 중...
    </div>
  )
});

export default function CalculatorPage() {
  const [selectedCalculator, setSelectedCalculator] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CalculationResult | null>(null);
  
  const [tankInputs, setTankInputs] = useState({
    diameter: '',
    height: '',
    topHeadType: 'flat',
    bottomHeadType: 'flat',
    material: 'carbon'
  });
  
  const [npshInputs, setNpshInputs] = useState({
    atmosphericPressure: '',
    vaporPressure: '',
    staticHead: '',
    frictionLoss: ''
  });
  
  const [affinityInputs, setAffinityInputs] = useState({
    q1: '',
    h1: '',
    p1: '',
    n1: '',
    n2: ''
  });

  const handleCalculate = async () => {
    setIsLoading(true);
    try {
      let calculationResult;
      
      if (selectedCalculator === 'tank') {
        calculationResult = await calculateTankVolume({
          diameter: parseFloat(tankInputs.diameter),
          height: parseFloat(tankInputs.height),
          topHeadType: tankInputs.topHeadType,
          bottomHeadType: tankInputs.bottomHeadType,
          material: tankInputs.material
        });
      } else if (selectedCalculator === 'npsh') {
        calculationResult = await calculateNPSH({
          atmospheric_pressure: parseFloat(npshInputs.atmosphericPressure),
          vapor_pressure: parseFloat(npshInputs.vaporPressure),
          static_head: parseFloat(npshInputs.staticHead),
          friction_loss: parseFloat(npshInputs.frictionLoss)
        });
      } else if (selectedCalculator === 'affinity') {
        calculationResult = await calculateAffinity({
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

  const renderCalculatorInputs = () => {
    if (selectedCalculator === 'tank') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                직경 (m)
              </label>
              <input
                type="number"
                value={tankInputs.diameter}
                onChange={(e) => setTankInputs({...tankInputs, diameter: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="3.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                높이 (m)
              </label>
              <input
                type="number"
                value={tankInputs.height}
                onChange={(e) => setTankInputs({...tankInputs, height: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="5.0"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              상부 헤드 타입
            </label>
            <select
              title="상부 헤드 타입 선택"
              value={tankInputs.topHeadType}
              onChange={(e) => setTankInputs({...tankInputs, topHeadType: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="flat">Flat Head</option>
              <option value="elliptical">Elliptical Head</option>
              <option value="hemispherical">Hemispherical Head</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              하부 헤드 타입
            </label>
            <select
              title="하부 헤드 타입 선택"
              value={tankInputs.bottomHeadType}
              onChange={(e) => setTankInputs({...tankInputs, bottomHeadType: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="flat">Flat Head</option>
              <option value="elliptical">Elliptical Head</option>
              <option value="hemispherical">Hemispherical Head</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              재질
            </label>
            <select
              title="재질 선택"
              value={tankInputs.material}
              onChange={(e) => setTankInputs({...tankInputs, material: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="carbon">Carbon Steel</option>
              <option value="stainless">Stainless Steel</option>
              <option value="aluminum">Aluminum</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              두께 (mm)
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              밀도 (kg/m³)
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="7850"
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
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              대기압 (kPa)
            </label>
            <input
              type="number"
              value={npshInputs.atmosphericPressure}
              onChange={(e) => setNpshInputs({...npshInputs, atmosphericPressure: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="101.325"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              증기압 (kPa)
            </label>
            <input
              type="number"
              value={npshInputs.vaporPressure}
              onChange={(e) => setNpshInputs({...npshInputs, vaporPressure: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="2.34"
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
              placeholder="5.0"
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
              placeholder="1.5"
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
              placeholder="1750"
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
    <Layout title="엔지니어링 계산기">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            대시보드로 돌아가기
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            엔지니어링 계산기
          </h1>
        </div>
        
        <div className="flex gap-6">
          {/* 좌측 계산기 탭 사이드바 */}
          <div className="w-64 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              계산기 선택
            </h2>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedCalculator('tank')}
                className={`w-full p-4 rounded-lg text-left transition-all duration-200 ${
                  selectedCalculator === 'tank'
                    ? 'bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border-2 border-blue-200 dark:border-blue-700'
                    : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                    🏗️
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Tank 부피 계산
                    </h3>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => setSelectedCalculator('npsh')}
                className={`w-full p-4 rounded-lg text-left transition-all duration-200 ${
                  selectedCalculator === 'npsh'
                    ? 'bg-green-50 dark:bg-green-900 dark:bg-opacity-20 border-2 border-green-200 dark:border-green-700'
                    : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                    💧
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      NPSH 계산
                    </h3>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => setSelectedCalculator('affinity')}
                className={`w-full p-4 rounded-lg text-left transition-all duration-200 ${
                  selectedCalculator === 'affinity'
                    ? 'bg-purple-50 dark:bg-purple-900 dark:bg-opacity-20 border-2 border-purple-200 dark:border-purple-700'
                    : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                    ⚙️
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      상사법칙 계산
                    </h3>
                  </div>
                </div>
              </button>
            </div>
            

          </div>
          
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
                    {(selectedCalculator === 'npsh' || selectedCalculator === 'affinity') && (
                       <div className="h-96">
                         <PumpVisualization />
                       </div>
                     )}
                     {selectedCalculator !== 'tank' && selectedCalculator !== 'npsh' && selectedCalculator !== 'affinity' && (
                       <div className="h-96 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                         <p className="text-gray-500 dark:text-gray-400">
                           3D 시각화는 Tank, NPSH, 상사법칙 계산기에서 지원됩니다
                         </p>
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {Object.entries(result).map(([key, value]) => (
                        <div key={key} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            {key === 'volume' && '부피'}
                            {key === 'weight' && '무게'}
                            {key === 'npsh' && 'NPSH'}
                            {key === 'q2' && '새 유량'}
                            {key === 'h2' && '새 양정'}
                            {key === 'p2' && '새 동력'}
                          </div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-white">
                            {typeof value === 'number' ? value.toFixed(2) : 
                             typeof value === 'object' ? JSON.stringify(value) : 
                             String(value)}
                            {key === 'volume' && ' m³'}
                            {key === 'weight' && ' kg'}
                            {key === 'npsh' && ' m'}
                            {(key === 'flow' || key === 'q2') && ' m³/h'}
                            {(key === 'head' || key === 'h2') && ' m'}
                            {(key === 'power' || key === 'p2') && ' kW'}
                          </div>
                        </div>
                      ))}
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
    </Layout>
  );
}