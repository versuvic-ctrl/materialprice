'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import dynamic from 'next/dynamic';

const NPSHVisualization = dynamic(() => import('@/components/calculator/NPSHVisualization'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full">이미지 로딩 중...</div>
});

// 압력 단위 변환 함수
const convertPressure = (value: number, fromUnit: string, toUnit: string): number => {
  // 모든 값을 Pa로 변환
  let valueInPa = value;
  switch (fromUnit) {
    case 'Pa': valueInPa = value; break;
    case 'kPa': valueInPa = value * 1000; break;
    case 'bar': valueInPa = value * 100000; break;
    case 'psi': valueInPa = value * 6895; break;
    case 'mmHg': valueInPa = value * 133.322; break;
    case 'atm': valueInPa = value * 101325; break;
  }
  
  // Pa에서 목표 단위로 변환
  switch (toUnit) {
    case 'Pa': return valueInPa;
    case 'kPa': return valueInPa / 1000;
    case 'bar': return valueInPa / 100000;
    case 'psi': return valueInPa / 6895;
    case 'mmHg': return valueInPa / 133.322;
    case 'atm': return valueInPa / 101325;
    default: return valueInPa;
  }
};

// 물의 증기압 계산 (Antoine 방정식) - 하위 호환성을 위해 유지
const getWaterVaporPressure = (temp: number): number => {
  const A = 8.07131;
  const B = 1730.63;
  const C = 233.426;
  
  const logP = A - (B / (C + temp));
  const pressureMmHg = Math.pow(10, logP);
  const pressurePa = pressureMmHg * 133.322;
  
  return pressurePa;
};

// 선택된 유체의 증기압 계산 (Antoine 방정식)
const getVaporPressure = (temp: number, fluidKey: string): number => {
  const fluid = ANTOINE_DATABASE[fluidKey];
  if (!fluid) {
    console.warn(`Unknown fluid: ${fluidKey}, using water as default`);
    return getWaterVaporPressure(temp);
  }
  
  // 온도 범위 확인
  if (temp < fluid.tMin || temp > fluid.tMax) {
    console.warn(`Temperature ${temp}°C is outside valid range (${fluid.tMin}°C to ${fluid.tMax}°C) for ${fluid.name}`);
  }
  
  const { A, B, C } = fluid;
  const logP = A - (B / (C + temp));
  const pressureMmHg = Math.pow(10, logP);
  const pressurePa = pressureMmHg * 133.322;
  
  return pressurePa;
};

// Antoine 계수 데이터베이스
interface AntoineCoefficients {
  A: number;
  B: number;
  C: number;
  tMin: number;
  tMax: number;
  name: string;
  density: number; // kg/m³ at 20°C
}

const ANTOINE_DATABASE: Record<string, AntoineCoefficients> = {
  water: {
    A: 8.07131,
    B: 1730.63,
    C: 233.426,
    tMin: -20,
    tMax: 100,
    name: '물 (Water)',
    density: 998.2
  },
  ethanol: {
    A: 8.20417,
    B: 1642.89,
    C: 230.300,
    tMin: -57,
    tMax: 80,
    name: '에탄올 (Ethanol)',
    density: 789.0
  },
  benzene: {
    A: 6.90565,
    B: 1211.033,
    C: 220.79,
    tMin: -16,
    tMax: 104,
    name: '벤젠 (Benzene)',
    density: 876.5
  },
  toluene: {
    A: 6.95464,
    B: 1344.8,
    C: 219.482,
    tMin: -95,
    tMax: 110,
    name: '톨루엔 (Toluene)',
    density: 866.9
  },
  acetone: {
    A: 7.2316,
    B: 1277.03,
    C: 237.23,
    tMin: -32,
    tMax: 77,
    name: '아세톤 (Acetone)',
    density: 784.0
  },
  methanol: {
    A: 8.08097,
    B: 1582.271,
    C: 239.726,
    tMin: -44,
    tMax: 64,
    name: '메탄올 (Methanol)',
    density: 791.8
  },
  chloroform: {
    A: 6.9371,
    B: 1171.2,
    C: 227,
    tMin: -13,
    tMax: 97,
    name: '클로로포름 (Chloroform)',
    density: 1489.0
  },
  cyclohexane: {
    A: 6.8413,
    B: 1201.531,
    C: 222.647,
    tMin: 6,
    tMax: 105,
    name: '사이클로헥산 (Cyclohexane)',
    density: 778.1
  }
};

export default function NPSHCalculator() {
  const [isLoading, setIsLoading] = useState(false);
  const [showFormulas, setShowFormulas] = useState(false);
  
  // 계산 상태 관리
  const [isCalculated, setIsCalculated] = useState(false);
  const [calculatedNPSH, setCalculatedNPSH] = useState<number | null>(null);

  // Tank Position 상태
  const [tankPosition, setTankPosition] = useState<'above' | 'below'>('above');

  // 탱크 타입 상태 (대기개방식/밀폐탱크)
  const [tankType, setTankType] = useState<'open' | 'closed'>('open');

  // 선택된 유체 상태
  const [selectedFluid, setSelectedFluid] = useState<string>('water');

  // 입력 상태
  const [atmosphericPressure, setAtmosphericPressure] = useState<string>('101.325');
  const [atmosphericPressureUnit, setAtmosphericPressureUnit] = useState<string>('kPa');
  
  const [surfacePressure, setSurfacePressure] = useState<string>('0');
  const [surfacePressureUnit, setSurfacePressureUnit] = useState<string>('kPa');
  
  const [vaporPressure, setVaporPressure] = useState<string>('2.337');
  const [vaporPressureUnit, setVaporPressureUnit] = useState<string>('kPa');
  
  const [liquidDensity, setLiquidDensity] = useState<string>('998.2');
  const [temperature, setTemperature] = useState<string>('20');
  
  const [distance, setDistance] = useState<string>('2');
  const [frictionLoss, setFrictionLoss] = useState<string>('1.5');
  
  // NPSHR 입력 상태 추가
  const [npshr, setNpshr] = useState<string>('');

  // 유체 변경 시 밀도 자동 업데이트
  useEffect(() => {
    const fluid = ANTOINE_DATABASE[selectedFluid];
    if (fluid) {
      setLiquidDensity(fluid.density.toString());
    }
  }, [selectedFluid]);

  // 온도 또는 유체 변화 시 증기압 자동 계산
  useEffect(() => {
    const temp = parseFloat(temperature);
    if (!isNaN(temp)) {
      const vaporPressurePa = getVaporPressure(temp, selectedFluid);
      const vaporPressureKPa = vaporPressurePa / 1000;
      setVaporPressure(vaporPressureKPa.toFixed(3));
    }
  }, [temperature, selectedFluid]);

  // 탱크 타입 변경 시 표면압력 자동 제어
  useEffect(() => {
    if (tankType === 'open') {
      // 대기개방식: 표면압력을 0으로 설정
      setSurfacePressure('0');
    }
  }, [tankType]);

  // 계산 결과 상태
  const [result, setResult] = useState<{
    npshAvailable: number;
    atmosphericHead: number;
    vaporHead: number;
    surfaceHead: number;
    safetyStatus: 'Safe' | 'Caution' | 'Danger';
  } | null>(null);

  const handleCalculate = () => {
    try {
      setIsLoading(true);
      
      // 모든 압력을 Pa로 변환
      const atmPressurePa = convertPressure(parseFloat(atmosphericPressure), atmosphericPressureUnit, 'Pa');
      const surfPressurePa = convertPressure(parseFloat(surfacePressure), surfacePressureUnit, 'Pa');
      const vapPressurePa = convertPressure(parseFloat(vaporPressure), vaporPressureUnit, 'Pa');
      
      const density = parseFloat(liquidDensity);
      const g = 9.81;
      const dist = parseFloat(distance);
      const friction = parseFloat(frictionLoss);
      
      // 표면 압력 = 대기압 + 표면압력
      const totalSurfacePressure = atmPressurePa + surfPressurePa;
      
      // Tank Position에 따른 Z 값 조정
      const Z = tankPosition === 'above' ? dist : -dist;
      
      // NPSH Available 계산
      const npshAvailable = ((totalSurfacePressure - vapPressurePa) / (density * g)) + Z - friction;
      
      // 각 구성 요소 계산 (미터 단위)
      const atmosphericHead = atmPressurePa / (density * g);
      const vaporHead = vapPressurePa / (density * g);
      const surfaceHead = totalSurfacePressure / (density * g);
      
      // 안전성 평가 (NPSHR 고려)
      let safetyStatus: 'Safe' | 'Caution' | 'Danger' = 'Safe';
      
      if (npshr && parseFloat(npshr) > 0) {
        // NPSHR이 입력된 경우: 1.3배 안전 기준 적용
        const ratio = npshAvailable / parseFloat(npshr);
        if (ratio < 1.0) {
          safetyStatus = 'Danger';  // NPSH Available < NPSHR
        } else if (ratio < 1.3) {
          safetyStatus = 'Caution'; // 1.0 ≤ ratio < 1.3 (안전 마진 부족)
        } else {
          safetyStatus = 'Safe';    // ratio ≥ 1.3 (충분한 안전 마진)
        }
      } else {
        // NPSHR이 입력되지 않은 경우: 기존 절대값 기준 적용
        if (npshAvailable < 2) {
          safetyStatus = 'Danger';
        } else if (npshAvailable < 3) {
          safetyStatus = 'Caution';
        }
      }
      
      setResult({
        npshAvailable,
        atmosphericHead,
        vaporHead,
        surfaceHead,
        safetyStatus
      });
      
      // 계산 상태 업데이트
      setCalculatedNPSH(npshAvailable);
      setIsCalculated(true);
      
      toast.success('NPSH 계산이 완료되었습니다.');
    } catch (error) {
      console.error('계산 오류:', error);
      toast.error('계산 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 온도 변경 시 자동으로 증기압 업데이트
  const handleTemperatureChange = (temp: string) => {
    setTemperature(temp);
    if (temp && !isNaN(parseFloat(temp))) {
      const vapPressurePa = getVaporPressure(parseFloat(temp), selectedFluid);
      const vapPressureInUnit = convertPressure(vapPressurePa, 'Pa', vaporPressureUnit);
      setVaporPressure(vapPressureInUnit.toFixed(3));
    }
  };



  return (
    <div className="space-y-6 px-2 sm:px-0">
      {/* 메인 레이아웃: 2열 그리드 (동일한 폭) - 모바일에서는 1열 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-fit">
        {/* 1열: 입력 필드 */}
        <div className="col-span-1 flex flex-col">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 flex-1">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              💧 NPSH Calculator
            </h3>
            
            <div className="space-y-3">
              {/* Tank Position */}
              <div className="flex flex-col sm:flex-row sm:items-center">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-0 sm:w-1/2 sm:pr-2">
                  Tank Position (탱크 위치)
                </label>
                <div className="sm:w-1/2">
                  <select
                    aria-label="Tank Position"
                    value={tankPosition}
                    onChange={(e) => setTankPosition(e.target.value as 'above' | 'below')}
                    className="w-full px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  >
                    <option value="above">Above Pump (펌프 위)</option>
                    <option value="below">Below Pump (펌프 아래)</option>
                  </select>
                </div>
              </div>

              {/* 탱크 타입 선택 */}
              <div className="flex flex-col sm:flex-row sm:items-center border-b border-gray-300 dark:border-gray-600 pb-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-0 sm:w-1/2 sm:pr-2">
                  탱크 타입 (Tank Type)
                </label>
                <div className="sm:w-1/2">
                  <select
                    aria-label="Tank Type"
                    value={tankType}
                    onChange={(e) => setTankType(e.target.value as 'open' | 'closed')}
                    className="w-full px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  >
                    <option value="open">대기개방식 (Open Tank)</option>
                    <option value="closed">밀폐탱크 (Closed Tank)</option>
                  </select>
                </div>
              </div>

              {/* 유체 선택 */}
              <div className="flex flex-col sm:flex-row sm:items-center">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-0 sm:w-1/2 sm:pr-2">
                  유체 선택 (Fluid Selection)
                </label>
                <div className="sm:w-1/2">
                  <select
                    aria-label="Fluid Selection"
                    value={selectedFluid}
                    onChange={(e) => setSelectedFluid(e.target.value)}
                    className="w-full px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  >
                    {Object.entries(ANTOINE_DATABASE).map(([key, fluid]) => (
                      <option key={key} value={key}>
                        {fluid.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 압력 입력 필드들 */}
              <div className="space-y-2">
                {/* 대기압 */}
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-0 sm:w-1/2 sm:pr-2">
                    대기압 (Atmospheric pressure)
                  </label>
                  <div className="sm:w-1/2 flex">
                    <input
                      type="number"
                      value={atmosphericPressure}
                      onChange={(e) => setAtmosphericPressure(e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                      placeholder="101325"
                    />
                    <select
                      aria-label="Atmospheric Pressure Unit"
                      value={atmosphericPressureUnit}
                      onChange={(e) => setAtmosphericPressureUnit(e.target.value)}
                      className="w-auto sm:w-16 px-1 py-1 border-l-0 border border-gray-300 dark:border-gray-600 rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-xs"
                    >
                      <option value="Pa">Pa</option>
                      <option value="kPa">kPa</option>
                      <option value="bar">bar</option>
                      <option value="psi">psi</option>
                      <option value="atm">atm</option>
                    </select>
                  </div>
                </div>

                {/* 표면압력 */}
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label className="w-full sm:w-1/2 text-sm font-medium text-gray-700 dark:text-gray-300 pr-2 mb-2 sm:mb-0">
                    표면압력 (Surface pressure)
                    {tankType === 'open' && (
                      <span className="text-xs text-gray-500 block">(대기압과 동일)</span>
                    )}
                  </label>
                  <div className="w-full sm:w-1/2 flex">
                    <input
                      type="number"
                      value={surfacePressure}
                      onChange={(e) => setSurfacePressure(e.target.value)}
                      disabled={tankType === 'open'}
                      className={`flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm ${
                        tankType === 'open' 
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed' 
                          : ''
                      }`}
                      placeholder="0"
                    />
                    <select
                      aria-label="Surface Pressure Unit"
                      value={surfacePressureUnit}
                      onChange={(e) => setSurfacePressureUnit(e.target.value)}
                      disabled={tankType === 'open'}
                      className={`w-auto sm:w-16 px-1 py-1 border-l-0 border border-gray-300 dark:border-gray-600 rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-xs ${
                        tankType === 'open' 
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed appearance-none' 
                          : ''
                      }`}
                      style={tankType === 'open' ? {
                        backgroundImage: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none'
                      } : {}}
                    >
                      <option value="Pa">Pa</option>
                      <option value="kPa">kPa</option>
                      <option value="bar">bar</option>
                      <option value="psi">psi</option>
                      <option value="atm">atm</option>
                    </select>
                  </div>
                </div>

                {/* 증기압 */}
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label className="w-full sm:w-1/2 text-sm font-medium text-gray-700 dark:text-gray-300 pr-2 mb-2 sm:mb-0">
                    증기압 (Vapor pressure)
                  </label>
                  <div className="w-full sm:w-1/2 flex">
                    <input
                      type="number"
                      value={vaporPressure}
                      onChange={(e) => setVaporPressure(e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                      placeholder="2337"
                    />
                    <select
                      aria-label="Vapor Pressure Unit"
                      value={vaporPressureUnit}
                      onChange={(e) => setVaporPressureUnit(e.target.value)}
                      className="w-auto sm:w-16 px-1 py-1 border-l-0 border border-gray-300 dark:border-gray-600 rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-xs"
                    >
                      <option value="Pa">Pa</option>
                      <option value="kPa">kPa</option>
                      <option value="bar">bar</option>
                      <option value="psi">psi</option>
                      <option value="atm">atm</option>
                    </select>
                  </div>
                </div>

                {/* 액체 밀도 */}
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label className="w-full sm:w-1/2 text-sm font-medium text-gray-700 dark:text-gray-300 pr-2 mb-2 sm:mb-0">
                    액체 밀도 (Liquid density)
                  </label>
                  <div className="w-full sm:w-1/2 flex">
                    <input
                      type="number"
                      value={liquidDensity}
                      onChange={(e) => setLiquidDensity(e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                      placeholder="1000"
                    />
                    <select
                      aria-label="Liquid Density Unit"
                      value="kg/m³"
                      disabled
                      className="w-auto px-1 py-1 border-l-0 border border-gray-300 dark:border-gray-600 rounded-r-md bg-gray-100 dark:bg-gray-600 text-xs text-gray-600 dark:text-gray-300 appearance-none"
                      style={{
                        backgroundImage: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none'
                      }}
                    >
                      <option value="kg/m³">kg/m³</option>
                    </select>
                  </div>
                </div>

                {/* 온도 */}
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-0 sm:w-1/2 sm:pr-2">
                    온도 (Temperature)
                  </label>
                  <div className="sm:w-1/2 flex">
                    <input
                      type="number"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                      placeholder="20"
                    />
                    <select
                      aria-label="Temperature Unit"
                      value="°C"
                      disabled
                      className="w-auto px-1 py-1 border-l-0 border border-gray-300 dark:border-gray-600 rounded-r-md bg-gray-100 dark:bg-gray-600 text-xs text-gray-600 dark:text-gray-300 appearance-none"
                      style={{
                        backgroundImage: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none'
                      }}
                    >
                      <option value="°C">°C</option>
                    </select>
                  </div>
                </div>

                {/* 유체와 펌프 간 거리 */}
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-0 sm:w-1/2 sm:pr-2">
                    거리 (Distance)
                  </label>
                  <div className="sm:w-1/2 flex">
                    <input
                      type="number"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                      placeholder="5"
                    />
                    <select
                      aria-label="Distance Unit"
                      value="m"
                      disabled
                      className="w-auto px-1 py-1 border-l-0 border border-gray-300 dark:border-gray-600 rounded-r-md bg-gray-100 dark:bg-gray-600 text-xs text-gray-600 dark:text-gray-300 appearance-none"
                      style={{
                        backgroundImage: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none'
                      }}
                    >
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>

                {/* 마찰 손실 */}
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-0 sm:w-1/2 sm:pr-2">
                    마찰 손실 (Friction loss)
                  </label>
                  <div className="sm:w-1/2 flex">
                    <input
                      type="number"
                      value={frictionLoss}
                      onChange={(e) => setFrictionLoss(e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                      placeholder="0.5"
                    />
                    <select
                      aria-label="Friction Loss Unit"
                      value="m"
                      disabled
                      className="w-auto px-1 py-1 border-l-0 border border-gray-300 dark:border-gray-600 rounded-r-md bg-gray-100 dark:bg-gray-600 text-xs text-gray-600 dark:text-gray-300 appearance-none"
                      style={{
                        backgroundImage: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none'
                      }}
                    >
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>

                {/* NPSHR 입력 필드 추가 */}
                <div className="flex flex-col sm:flex-row sm:items-center border-t border-gray-300 dark:border-gray-600 pt-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-0 sm:w-1/2 sm:pr-2">
                    NPSH Required (펌프 요구값)
                  </label>
                  <div className="sm:w-1/2 flex">
                    <input
                      type="number"
                      value={npshr}
                      onChange={(e) => setNpshr(e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                      placeholder="펌프 데이터시트 값"
                    />
                    <select
                      aria-label="NPSHR Unit"
                      value="m"
                      disabled
                      className="w-16 px-1 py-1 border-l-0 border border-gray-300 dark:border-gray-600 rounded-r-md bg-gray-100 dark:bg-gray-600 text-xs text-gray-600 dark:text-gray-300 appearance-none"
                      style={{
                        backgroundImage: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none'
                      }}
                    >
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* 계산 버튼 */}
            <button 
              onClick={handleCalculate} 
              disabled={isLoading}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-3 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  계산 중...
                </>
              ) : (
                'NPSH 계산하기'
              )}
            </button>
          </div>
        </div>
        
        {/* 2열: 시각화 */}
        <div className="col-span-1 flex flex-col">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 flex-1">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              📊 NPSH 시각화
            </h3>
            
            <div className="h-96 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <NPSHVisualization 
                tankPosition={tankPosition}
                atmosphericPressure={parseFloat(atmosphericPressure) || 101325}
                atmosphericPressureUnit={atmosphericPressureUnit}
                surfacePressure={parseFloat(surfacePressure) || 101325}
                surfacePressureUnit={surfacePressureUnit}
                vaporPressure={parseFloat(vaporPressure) || 2337}
                vaporPressureUnit={vaporPressureUnit}
                liquidDensity={Number(liquidDensity) || 1000}
                temperature={parseFloat(temperature) || 20}
                distance={parseFloat(distance) || 5}
                frictionLoss={parseFloat(frictionLoss) || 0.5}
                calculatedNPSH={calculatedNPSH ?? undefined}
                showCalculation={isCalculated}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 계산 결과 */}
      {result && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            📊 계산 결과
          </h3>
          
          {/* NPSH Available 메인 결과 */}
          <div className="mb-6">
            <div className={`p-6 rounded-lg border-2 ${result.safetyStatus === 'Safe' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' : 
              result.safetyStatus === 'Caution' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <h4 className={`text-lg font-semibold ${result.safetyStatus === 'Safe' ? 'text-green-800 dark:text-green-200' : 
                    result.safetyStatus === 'Caution' ? 'text-yellow-800 dark:text-yellow-200' : 'text-red-800 dark:text-red-200'}`}>
                    NPSH Available
                  </h4>
                  <p className={`text-3xl font-bold ${result.safetyStatus === 'Safe' ? 'text-green-600 dark:text-green-400' : 
                    result.safetyStatus === 'Caution' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                    {result.npshAvailable.toFixed(2)} m
                  </p>
                  <p className={`text-sm ${result.safetyStatus === 'Safe' ? 'text-green-600 dark:text-green-400' : 
                    result.safetyStatus === 'Caution' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                    {result.safetyStatus}
                  </p>
                </div>
                
                {/* NPSHR 비교 */}
                {npshr && parseFloat(npshr) > 0 && (
                  <div className="text-right">
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">NPSH Required</h5>
                    <p className="text-xl font-bold text-gray-600 dark:text-gray-400">{parseFloat(npshr).toFixed(2)} m</p>
                    <div className="mt-2">
                      {(() => {
                        const ratio = result.npshAvailable / parseFloat(npshr);
                        const isAdequate = ratio >= 1.3;
                        return (
                          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                            isAdequate 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
                              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                          }`}>
                            {isAdequate ? '✓ 충족' : '✗ 부족'} (×{ratio.toFixed(1)})
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* 공식 구성요소 분석 */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">공식 구성요소 분석</h4>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
              <p className="font-mono text-sm text-center bg-white dark:bg-gray-800 p-3 rounded border">
                 NPSH Available = <span className="text-blue-600 dark:text-blue-400">(Psurf - Pvap)</span> / (ρ × g) {tankPosition === 'above' ? '+ Z' : '- Z'} - Hl
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center mt-2">
                 = <span className="text-blue-600 dark:text-blue-400">압력 헤드</span> {tankPosition === 'above' ? '+ 정압 수두' : '- 흡입 양정'} - 마찰 손실
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 압력 헤드 구성요소 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                <h5 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">압력 헤드 구성</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">대기압 헤드:</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">+{result.atmosphericHead.toFixed(2)} m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">증기압 헤드:</span>
                    <span className="font-medium text-purple-600 dark:text-purple-400">-{result.vaporHead.toFixed(2)} m</span>
                  </div>
                  <div className="border-t border-blue-200 dark:border-blue-600 pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span className="text-blue-800 dark:text-blue-200">순 압력 헤드:</span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {(result.atmosphericHead - result.vaporHead).toFixed(2)} m
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 위치 헤드 */}
              <div className={`p-4 rounded-lg border ${tankPosition === 'above' 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
                : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700'}`}>
                <h5 className={`font-semibold mb-3 ${tankPosition === 'above' 
                  ? 'text-green-800 dark:text-green-200' 
                  : 'text-orange-800 dark:text-orange-200'}`}>
                  위치 헤드
                </h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">탱크 위치:</span>
                    <span className="font-medium">{tankPosition === 'above' ? '펌프 위' : '펌프 아래'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">거리:</span>
                    <span className="font-medium">{distance} m</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>위치 헤드:</span>
                      <span className={tankPosition === 'above' 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-orange-600 dark:text-orange-400'}>
                        {tankPosition === 'above' ? '+' : '-'}{distance} m
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 손실 헤드 */}
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-700">
                <h5 className="font-semibold text-red-800 dark:text-red-200 mb-3">손실 헤드</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">마찰 손실:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">-{frictionLoss} m</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    배관, 밸브, 피팅 등에 의한 압력 손실
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* 계산 요약 */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="font-semibold mb-3">계산 요약</h4>
            <div className="font-mono text-sm space-y-1">
              <div className="flex justify-between">
                <span>압력 헤드 (Psurf - Pvap)/(ρ×g):</span>
                <span className="text-blue-600 dark:text-blue-400">
                  {(result.atmosphericHead - result.vaporHead).toFixed(2)} m
                </span>
              </div>
              <div className="flex justify-between">
                <span>위치 헤드 ({tankPosition === 'above' ? '+' : '-'}Z):</span>
                <span className={tankPosition === 'above' 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-orange-600 dark:text-orange-400'}>
                  {tankPosition === 'above' ? '+' : '-'}{distance} m
                </span>
              </div>
              <div className="flex justify-between">
                <span>마찰 손실 (-Hl):</span>
                <span className="text-red-600 dark:text-red-400">-{frictionLoss} m</span>
              </div>
              <div className="border-t border-gray-300 dark:border-gray-600 pt-2 mt-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>NPSH Available:</span>
                  <span className={result.safetyStatus === 'Safe' ? 'text-green-600 dark:text-green-400' : 
                    result.safetyStatus === 'Caution' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}>
                    {result.npshAvailable.toFixed(2)} m
                  </span>
                </div>
              </div>
            </div>
            
            {/* NPSHR 비교 요약 */}
            {npshr && parseFloat(npshr) > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">펌프 요구값 대비:</span>
                  <div className="text-right">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {result.npshAvailable.toFixed(2)} m ÷ {parseFloat(npshr).toFixed(2)} m = ×{(result.npshAvailable / parseFloat(npshr)).toFixed(1)}
                    </div>
                    <div className={`text-sm font-medium ${
                      (result.npshAvailable / parseFloat(npshr)) >= 1.3 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {(result.npshAvailable / parseFloat(npshr)) >= 1.3 
                        ? '✓ 1.3배 이상 충족 (안전)' 
                        : '✗ 1.3배 미만 (위험)'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3행: 상세 공식 펼치기 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setShowFormulas(!showFormulas)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">상세 공식 및 이론</h3>
          {showFormulas ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>

        {showFormulas && (
          <div className="px-6 pb-6 space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">NPSH Available 공식</h4>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p><strong>NPSH Available = (Psurf - Pvap)/(ρ×g) - Z - Hf</strong></p>
                <p>• Psurf: 표면 압력 = Patm + Pres (Pa)</p>
                <p>• Pvap: 증기압 (Pa)</p>
                <p>• ρ: 액체 밀도 (kg/m³)</p>
                <p>• g: 중력가속도 (9.81 m/s²)</p>
                <p>• Z: 액체 표면과 펌프 입구 사이의 높이 (m)</p>
                <p>• Hf: 마찰 손실 (m)</p>
              </div>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
              <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-3">Tank Position에 따른 Z 값</h4>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p><strong>Above Pump:</strong> 액체가 펌프보다 위에 있음 (Z = +거리)</p>
                <p><strong>Below Pump:</strong> 액체가 펌프보다 아래에 있음 (Z = -거리)</p>
                <p>• 양수 Z: 중력이 도움 (정압 수두)</p>
                <p>• 음수 Z: 중력이 방해 (흡입 양정)</p>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
              <h4 className="font-semibold text-green-800 dark:text-green-200 mb-3">물의 증기압 (Antoine 방정식)</h4>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p><strong>log₁₀(P) = A - B/(C + T)</strong></p>
                <p>• A = 8.07131, B = 1730.63, C = 233.426</p>
                <p>• T: 온도 (°C), P: 증기압 (mmHg)</p>
                <p>• Pa 변환: P(Pa) = P(mmHg) × 133.322</p>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-700">
              <h4 className="font-semibold text-red-800 dark:text-red-200 mb-3">NPSH 안전 기준</h4>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p><strong>NPSHR 기반 평가 (권장):</strong></p>
                <p>• <span className="text-green-600 dark:text-green-400 font-medium">안전:</span> NPSH Available ≥ 1.3 × NPSHR</p>
                <p>• <span className="text-yellow-600 dark:text-yellow-400 font-medium">주의:</span> 1.0 × NPSHR ≤ NPSH Available &lt; 1.3 × NPSHR</p>
                <p>• <span className="text-red-600 dark:text-red-400 font-medium">위험:</span> NPSH Available &lt; NPSHR</p>
                <p className="mt-3"><strong>절대값 기준 (NPSHR 미입력시):</strong></p>
                <p>• <span className="text-green-600 dark:text-green-400 font-medium">안전:</span> NPSH Available &gt; 3m</p>
                <p>• <span className="text-yellow-600 dark:text-yellow-400 font-medium">주의:</span> 2m &lt; NPSH Available ≤ 3m</p>
                <p>• <span className="text-red-600 dark:text-red-400 font-medium">위험:</span> NPSH Available ≤ 2m</p>
                <p className="mt-3 text-xs bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-700">
                  <strong>💡 중요:</strong> NPSHR은 펌프 제조사 데이터시트에서 확인하세요. 1.3배 안전 마진은 캐비테이션 방지를 위한 업계 표준입니다.
                </p>
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
              <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-3">NPSHR (Net Positive Suction Head Required)</h4>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p><strong>정의:</strong> 펌프가 캐비테이션 없이 정상 작동하기 위해 필요한 최소 NPSH 값</p>
                <p><strong>특성:</strong></p>
                <p>• 펌프 고유 특성 (제조사 데이터시트 제공)</p>
                <p>• 유량과 회전수에 따라 변화</p>
                <p>• 임펠러 설계와 직접적 관련</p>
                <p><strong>안전 운전 조건:</strong> NPSH Available ≥ 1.3 × NPSHR</p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                  ※ 1.3배 안전 마진은 제조 공차, 마모, 운전 조건 변화를 고려한 업계 표준입니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}