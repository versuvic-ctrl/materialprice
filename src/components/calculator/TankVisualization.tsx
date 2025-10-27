'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface TankVisualizationProps {
  tankType: string;
  diameter?: number;
  height?: number;
  length?: number;
  width?: number;
  radius1?: number;
  radius2?: number;
  topDiameter?: number;
  bottomDiameter?: number;
  cylinderHeight?: number;
  coneHeight?: number;
  unit?: string;
}

// Tank 타입과 이미지 파일 매핑
const TANK_TYPE_IMAGES = {
  'vertical-cylinder': '/tank type/vertical-cylinder-tank-volume.webp',
  'horizontal-cylinder': '/tank type/horizontal-cylinder-tank-volume.webp',
  'rectangular-prism': '/tank type/rectangular-prism-tank-volume.webp',
  'vertical-capsule': '/tank type/vertical-capsule-tank-volume.webp',
  'horizontal-capsule': '/tank type/horizontal-capsule-tank-volume.webp',
  'vertical-elliptical': '/tank type/vertical-elliptical-tank-volume.webp',
  'horizontal-elliptical': '/tank type/horizontal-elliptical-tank-volume.webp',
  'cone-bottom': '/tank type/cone-bottom-tank-volume.webp',
  'cone-top': '/tank type/cone-top-tank-volume.webp',
  'frustum': '/tank type/frustum-tank-volume.webp',
} as const;

// Tank 타입별 한글 이름
const TANK_TYPE_NAMES = {
  'vertical-cylinder': '수직 원통형',
  'horizontal-cylinder': '수평 원통형',
  'rectangular-prism': '직육면체',
  'vertical-capsule': '수직 캡슐형',
  'horizontal-capsule': '수평 캡슐형',
  'vertical-elliptical': '수직 타원형',
  'horizontal-elliptical': '수평 타원형',
  'cone-bottom': '원뿔 바닥형',
  'cone-top': '원뿔 상단형',
  'frustum': '절두체 (깔때기형)',
} as const;

export default function TankVisualization({
  tankType,
  diameter,
  height,
  length,
  width,
  radius1,
  radius2,
  topDiameter,
  bottomDiameter,
  cylinderHeight,
  coneHeight,
  unit = 'm'
}: TankVisualizationProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Tank 타입이 변경될 때마다 이미지 로딩 상태 초기화
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [tankType]);

  // 현재 Tank 타입에 해당하는 이미지 경로
  const currentImage = TANK_TYPE_IMAGES[tankType as keyof typeof TANK_TYPE_IMAGES];
  const currentName = TANK_TYPE_NAMES[tankType as keyof typeof TANK_TYPE_NAMES];

  // 치수 정보 생성
  const getDimensionInfo = () => {
    const dimensions: string[] = [];
    
    switch (tankType) {
      case 'vertical-cylinder':
      case 'horizontal-cylinder':
        if (diameter) dimensions.push(`직경: ${diameter}${unit}`);
        if (height) dimensions.push(`높이: ${height}${unit}`);
        if (length) dimensions.push(`길이: ${length}${unit}`);
        break;
      
      case 'rectangular-prism':
        if (length) dimensions.push(`길이: ${length}${unit}`);
        if (width) dimensions.push(`폭: ${width}${unit}`);
        if (height) dimensions.push(`높이: ${height}${unit}`);
        break;
      
      case 'vertical-capsule':
      case 'horizontal-capsule':
      case 'vertical-elliptical':
      case 'horizontal-elliptical':
        if (diameter) dimensions.push(`직경: ${diameter}${unit}`);
        if (height) dimensions.push(`높이: ${height}${unit}`);
        if (length) dimensions.push(`길이: ${length}${unit}`);
        break;
      
      case 'cone-bottom':
      case 'cone-top':
        if (topDiameter) dimensions.push(`상단 직경: ${topDiameter}${unit}`);
        if (bottomDiameter) dimensions.push(`하단 직경: ${bottomDiameter}${unit}`);
        if (cylinderHeight) dimensions.push(`원통 높이: ${cylinderHeight}${unit}`);
        if (coneHeight) dimensions.push(`원뿔 높이: ${coneHeight}${unit}`);
        break;
      
      case 'frustum':
        if (radius1) dimensions.push(`상단 반지름: ${radius1}${unit}`);
        if (radius2) dimensions.push(`하단 반지름: ${radius2}${unit}`);
        if (height) dimensions.push(`높이: ${height}${unit}`);
        break;
      
      default:
        if (diameter) dimensions.push(`직경: ${diameter}${unit}`);
        if (height) dimensions.push(`높이: ${height}${unit}`);
    }
    
    return dimensions;
  };

  const dimensionInfo = getDimensionInfo();

  // 이미지가 없는 경우 기본 표시
  if (!currentImage) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🛢️</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            {currentName || 'Tank 시각화'}
          </h3>
          <p className="text-sm text-gray-500">
            이미지를 불러올 수 없습니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg overflow-hidden relative">
      {/* 로딩 상태 */}
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">이미지 로딩 중...</p>
          </div>
        </div>
      )}

      {/* 에러 상태 */}
      {imageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center p-8">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              {currentName}
            </h3>
            <p className="text-sm text-gray-500">
              이미지를 불러올 수 없습니다
            </p>
          </div>
        </div>
      )}

      {/* Tank 타입 이미지 */}
      <div className="relative w-full h-full">
        <Image
          src={currentImage}
          alt={`${currentName} 구조도`}
          fill
          className={`object-contain p-4 transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          priority
        />
        
        {/* Tank 타입 정보 오버레이 */}
        {imageLoaded && (
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
            <h3 className="font-semibold text-gray-800 mb-1">
              {currentName}
            </h3>
            <p className="text-xs text-gray-600">
              {tankType}
            </p>
          </div>
        )}

        {/* 치수 정보 오버레이 */}
        {imageLoaded && dimensionInfo.length > 0 && (
          <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg max-w-xs">
            <h4 className="font-semibold text-gray-800 mb-2 text-sm">
              📏 치수 정보
            </h4>
            <div className="space-y-1">
              {dimensionInfo.map((dimension, index) => (
                <p key={index} className="text-xs text-gray-600 font-mono">
                  {dimension}
                </p>
              ))}
            </div>
          </div>
        )}


      </div>

      {/* 추가 정보 패널 (선택적) */}
      <div className="absolute top-1/2 left-2 transform -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity duration-300">
        <div className="bg-gray-800/80 text-white p-2 rounded-lg text-xs max-w-48">
          <p className="font-semibold mb-1">Tank 타입 특징:</p>
          <p className="text-gray-300">
            {tankType === 'vertical-cylinder' && '수직으로 설치되는 원통형 탱크'}
            {tankType === 'horizontal-cylinder' && '수평으로 설치되는 원통형 탱크'}
            {tankType === 'rectangular-prism' && '직육면체 형태의 저장 탱크'}
            {tankType === 'vertical-capsule' && '양 끝이 반구형인 수직 캡슐 탱크'}
            {tankType === 'horizontal-capsule' && '양 끝이 반구형인 수평 캡슐 탱크'}
            {tankType === 'vertical-elliptical' && '타원형 헤드를 가진 수직 탱크'}
            {tankType === 'horizontal-elliptical' && '타원형 헤드를 가진 수평 탱크'}
            {tankType === 'cone-bottom' && '바닥이 원뿔 형태인 탱크'}
            {tankType === 'cone-top' && '상단이 원뿔 형태인 탱크'}
            {tankType === 'frustum' && '절두체(깔때기) 형태의 탱크'}
          </p>
        </div>
      </div>
    </div>
  );
}