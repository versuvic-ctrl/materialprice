'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface NPSHVisualizationProps {
  tankPosition: 'above' | 'below';
  atmosphericPressure: number;
  atmosphericPressureUnit: string;
  surfacePressure: number;
  surfacePressureUnit: string;
  distance: number;
  frictionLoss: number;
  vaporPressure: number;
  vaporPressureUnit: string;
  liquidDensity: number;
  temperature: number;
  calculatedNPSH?: number; // 계산된 NPSH 값 (선택적)
  showCalculation?: boolean; // 계산 결과 표시 여부
}

export default function NPSHVisualization({
  tankPosition,
  atmosphericPressure,
  atmosphericPressureUnit,
  surfacePressure,
  surfacePressureUnit,
  distance,
  frictionLoss,
  vaporPressure,
  vaporPressureUnit,
  liquidDensity,
  temperature,
  calculatedNPSH,
  showCalculation = false
}: NPSHVisualizationProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // 이미지 경로 결정
  const imagePath = tankPosition === 'above' 
    ? '/npsh type/npsh_above pump.webp' 
    : '/npsh type/npsh_below pump.webp';

  // 이미지 로드 상태 초기화
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [tankPosition]);

  // 압력 단위 변환 함수
  const convertPressure = (value: number, fromUnit: string, toUnit: string): number => {
    let valueInPa = value;
    switch (fromUnit) {
      case 'Pa': valueInPa = value; break;
      case 'kPa': valueInPa = value * 1000; break;
      case 'bar': valueInPa = value * 100000; break;
      case 'psi': valueInPa = value * 6895; break;
      case 'mmHg': valueInPa = value * 133.322; break;
      case 'atm': valueInPa = value * 101325; break;
    }
    
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

  // NPSH Available 계산
  const calculateNPSH = () => {
    const atmPressurePa = convertPressure(atmosphericPressure, atmosphericPressureUnit, 'Pa');
    const surfPressurePa = convertPressure(surfacePressure, surfacePressureUnit, 'Pa');
    const vapPressurePa = convertPressure(vaporPressure, vaporPressureUnit, 'Pa');
    const g = 9.81;
    
    // 총 표면 압력 (대기압 + 표면압력)
    const totalSurfacePressure = atmPressurePa + surfPressurePa;
    
    // NPSH Available 계산
    const Z = tankPosition === 'above' ? distance : -distance;
    const npshAvailable = ((totalSurfacePressure - vapPressurePa) / (liquidDensity * g)) + Z - frictionLoss;
    
    return npshAvailable;
  };

  // NPSH 값 결정 (계산된 값이 있으면 사용, 없으면 내부 계산)
  const npshValue = showCalculation ? (calculatedNPSH ?? calculateNPSH()) : 0;

  // 안전성 상태 결정
  const getSafetyStatus = (npsh: number) => {
    if (npsh > 3) return { status: 'safe', color: 'text-green-600', bgColor: 'bg-green-100', label: '안전' };
    if (npsh > 2) return { status: 'warning', color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: '주의' };
    return { status: 'danger', color: 'text-red-600', bgColor: 'bg-red-100', label: '위험' };
  };

  const safetyInfo = getSafetyStatus(npshValue);

  if (imageError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
        <div className="text-center p-6">
          <div className="text-gray-400 dark:text-gray-500 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">이미지를 불러올 수 없습니다</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {tankPosition === 'above' ? 'Above Pump' : 'Below Pump'} 이미지
          </p>
          <button
            onClick={() => {
              setImageError(false);
              setImageLoaded(false);
            }}
            className="mt-3 px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
      {/* 로딩 상태 */}
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-700">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400">이미지 로딩 중...</p>
          </div>
        </div>
      )}

      {/* NPSH 이미지 */}
      <div className="relative w-full h-full">
        <Image
          src={imagePath}
          alt={`NPSH ${tankPosition === 'above' ? 'Above Pump' : 'Below Pump'} Configuration`}
          fill
          className="object-contain"
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageError(true);
            setImageLoaded(false);
          }}
          priority
        />

        {/* 이미지가 로드된 후 오버레이 정보 표시 */}
        {imageLoaded && (
          <>
            {/* 상단 우측: Tank Position 표시 (NPSH Available 위에 배치) */}
            <div className="absolute top-2 right-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-gray-200 dark:border-gray-600">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Tank Position</div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {tankPosition === 'above' ? 'Above Pump' : 'Below Pump'}
              </div>
            </div>

            {/* 상단 우측: NPSH 결과 (Tank Position 아래에 배치) */}
            <div className={`absolute top-16 right-2 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border ${showCalculation ? safetyInfo.bgColor + ' ' + safetyInfo.color : 'bg-gray-100 text-gray-600'} border-current/20`}>
              <div className="text-xs font-medium opacity-80">NPSH Available</div>
              <div className="text-lg font-bold">
                {showCalculation ? `${npshValue.toFixed(2)} m` : '계산 필요'}
              </div>
              <div className="text-xs font-medium opacity-80">
                {showCalculation ? safetyInfo.label : '계산하기 버튼을 눌러주세요'}
              </div>
            </div>

            {/* 하단 좌측: 주요 파라미터 */}
            <div className="absolute bottom-2 left-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-gray-200 dark:border-gray-600">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">주요 파라미터</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">거리 (Z):</span>
                  <span className="font-medium text-gray-900 dark:text-white">{distance.toFixed(1)} m</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">마찰손실:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{frictionLoss.toFixed(1)} m</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">온도:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{temperature.toFixed(0)}°C</span>
                </div>
              </div>
            </div>

            {/* 하단 우측: 압력 정보 */}
            <div className="absolute bottom-2 right-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-gray-200 dark:border-gray-600">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">압력 조건</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">대기압:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {atmosphericPressure.toFixed(1)} {atmosphericPressureUnit}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">증기압:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {vaporPressure.toFixed(2)} {vaporPressureUnit}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">밀도:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{liquidDensity.toFixed(0)} kg/m³</span>
                </div>
              </div>
            </div>

            {/* 중앙 하단: 설명 텍스트 */}
            <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-blue-500/90 text-white backdrop-blur-sm rounded-lg px-4 py-2 shadow-sm">
              <div className="text-xs text-center">
                {tankPosition === 'above' 
                  ? '액체가 펌프보다 위에 위치 (정압 수두)' 
                  : '액체가 펌프보다 아래에 위치 (흡입 양정)'
                }
              </div>
            </div>

            {/* 안전성 경고 (계산이 완료되고 위험한 경우에만 표시) */}
            {showCalculation && safetyInfo.status === 'danger' && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-500/95 text-white backdrop-blur-sm rounded-lg px-4 py-3 shadow-lg border-2 border-red-400">
                <div className="text-center">
                  <div className="text-lg font-bold mb-1">⚠️ 캐비테이션 위험</div>
                  <div className="text-sm">NPSH Available이 너무 낮습니다</div>
                  <div className="text-xs mt-1 opacity-90">펌프 성능 저하 및 손상 가능</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}