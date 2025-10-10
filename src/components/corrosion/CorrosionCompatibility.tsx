'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, AlertTriangle, CheckCircle, XCircle, Info, ChevronDown, Droplet } from 'lucide-react';
import alleimaCorrosionData from '@/data/alleima_corrosion_data_full.json';

console.log('Full alleimaCorrosionData:', alleimaCorrosionData);
console.log('Length of corrosion_data array:', alleimaCorrosionData.corrosion_data.length);

interface CorrosionRating {
  concentration: string;
  temperature: string;
  rating: string;
  cell_class: string[];
}

interface CompatibilityResult {
  material: string;
  concentration: string; // 농도 정보
  temperature: string;   // 온도 정보
  rating: string;
  cell_class: string[];
}

interface CorrosionDataEntry {
  chemical: string;
  chemical_url: string;
  material: string;
  corrosion_ratings: CorrosionRating[];
}

interface ChemicalLink {
  name: string;
  url: string;
  letter: string;
}

interface AlleimaCorrosionData {
  chemical_links: ChemicalLink[];
  symbol_clarification: { [key: string]: string };
  corrosion_data: CorrosionDataEntry[];
}

interface CorrosionCompatibilityProps {
  selectedMaterials?: any[];
}

const CorrosionCompatibility: React.FC<CorrosionCompatibilityProps> = ({ selectedMaterials = [] }) => {
  const [selectedChemical, setSelectedChemical] = useState<string>('');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [selectedRating, setSelectedRating] = useState<string>(''); // 호환성 등급 필터
  const [results, setResults] = useState<CompatibilityResult[]>([]);
  const [dynamicWidths, setDynamicWidths] = useState({
    material: 'w-1/6',
    concentration: 'w-1/4', 
    temperature: 'w-1/12',
    rating: 'w-1/8',
    remarks: 'w-5/12'
  });

  const data = alleimaCorrosionData as AlleimaCorrosionData;

  // 동적 컬럼 폭 계산 함수
  const calculateOptimalWidths = (results: CompatibilityResult[]) => {
    if (results.length === 0) return;

    const maxLengths = {
      material: Math.max(...results.map(r => r.material.length), 6), // 최소 6글자 (재질명)
      concentration: Math.max(...results.map(r => r.concentration.length), 4), // 최소 4글자 (농도)
      temperature: Math.max(...results.map(r => r.temperature.toString().length), 8), // 최소 8글자 (온도 (°C))
      rating: 8, // 호환성 등급은 고정
      remarks: Math.max(...results.map(r => {
        const desc = getDetailedRatingDescription(r.rating);
        return desc ? desc.replace(/<[^>]*>/g, '').length : 1; // HTML 태그 제거 후 길이 계산
      }), 4) // 최소 4글자 (비고)
    };

    // 전체 폭을 100%로 하여 비율 계산
    const totalLength = Object.values(maxLengths).reduce((sum, len) => sum + len, 0);
    
    // 최소 폭 보장 및 비율 계산
    const widths = {
      material: Math.max(maxLengths.material / totalLength * 100, 15), // 최소 15%
      concentration: Math.max(maxLengths.concentration / totalLength * 100, 20), // 최소 20%
      temperature: Math.max(maxLengths.temperature / totalLength * 100, 10), // 최소 10%
      rating: Math.max(maxLengths.rating / totalLength * 100, 12), // 최소 12%
      remarks: Math.max(maxLengths.remarks / totalLength * 100, 35) // 최소 35%
    };

    // 100%를 초과하지 않도록 조정
    const totalWidth = Object.values(widths).reduce((sum, width) => sum + width, 0);
    if (totalWidth > 100) {
      const factor = 100 / totalWidth;
      Object.keys(widths).forEach(key => {
        widths[key as keyof typeof widths] *= factor;
      });
    }

    // Tailwind CSS 클래스로 변환
    setDynamicWidths({
      material: `w-[${Math.round(widths.material)}%]`,
      concentration: `w-[${Math.round(widths.concentration)}%]`,
      temperature: `w-[${Math.round(widths.temperature)}%]`,
      rating: `w-[${Math.round(widths.rating)}%]`,
      remarks: `w-[${Math.round(widths.remarks)}%]`
    });
  };



  // 사용 가능한 등급 목록 추출 (실제 호환성 등급만)
  const availableRatings = useMemo(() => {
    // 실제 호환성 등급 패턴 정의 (이미지에서 확인된 실제 등급들 기반)
    const isValidRating = (rating: string): boolean => {
      if (!rating || rating.trim() === '') return false;
      
      const trimmedRating = rating.trim();
      
      // 기본 숫자 등급 (0, 1, 2)
      if (/^[0-2]$/.test(trimmedRating)) return true;
      
      // 숫자 + 부식 위험 문자 조합 (0p, 0c, 0s, 0ps, 0pc, 0cs, 1p, 1c, 1s, 1ps, 1pc, 1cs, 2p, 2c, 2s 등)
      if (/^[0-2][pcsig]+$/i.test(trimmedRating)) return true;
      
      // 특수 등급 (BP, ND)
      if (/^(BP|ND)$/i.test(trimmedRating)) return true;
      
      // 단독 부식 위험 문자 (p, c, s, ig)
      if (/^(p|c|s|ig)$/i.test(trimmedRating)) return true;
      
      // 부식 위험 문자 조합 (ps, pc, cs, pcs 등)
      if (/^[pcsig]{2,4}$/i.test(trimmedRating)) return true;
      
      return false;
    };
    
    const ratings = [...new Set(data.corrosion_data
      .flatMap(entry => entry.corrosion_ratings)
      .map(rating => rating.rating)
      .filter(isValidRating)
    )];
    
    return ratings.sort((a, b) => {
      // 숫자 등급을 먼저 정렬 (0, 1, 2)
      const aNum = a.match(/^(\d)/);
      const bNum = b.match(/^(\d)/);
      
      if (aNum && bNum) {
        const aNumVal = parseInt(aNum[1]);
        const bNumVal = parseInt(bNum[1]);
        if (aNumVal !== bNumVal) {
          return aNumVal - bNumVal;
        }
        // 같은 숫자면 문자 부분으로 정렬
        return a.localeCompare(b);
      }
      
      if (aNum && !bNum) return -1;
      if (!aNum && bNum) return 1;
      
      // 문자 등급은 알파벳 순으로 정렬
      return a.localeCompare(b);
    });
  }, [data.corrosion_data]);

  // 화학물질 목록 추출 (중복 제거)
  const availableChemicals = useMemo(() => {
    const chemicalNames = [...new Set(alleimaCorrosionData.chemical_links.map(entry => entry.name))];
    console.log('Number of available chemicals:', chemicalNames.length);
    return chemicalNames.sort();
  }, [alleimaCorrosionData.chemical_links]);

  // 재질 목록 추출 (중복 제거, "Grade or type of alloy:" 제외)
  const availableMaterials = useMemo(() => {
    const materialNames = [...new Set(data.corrosion_data
      .filter(entry => entry.material !== "Grade or type of alloy:")
      .map(entry => entry.material))];
    return materialNames.filter(name => name).sort();
  }, [data.corrosion_data]);

  // 선택된 화학물질에 대한 호환성 결과 (모든 재질의 모든 등급)
  const compatibilityResults = useMemo(() => {
    if (!selectedChemical) return [];
    
    const results: CompatibilityResult[] = [];
    
    // 선택된 화학물질의 모든 데이터 가져오기
    const chemicalEntries = data.corrosion_data.filter(entry => 
      entry.chemical === selectedChemical && entry.material !== "Grade or type of alloy:"
    );
    
    if (chemicalEntries.length === 0) return [];
    
    // 화학물질명에서 조건 해석
    const isMultipleChemicals = selectedChemical.includes('+');
    
    // 온도 정보 추출 (혼합 화학물질의 경우)
    let temperatureInfo: { [key: string]: string } = {};
    if (isMultipleChemicals) {
      const tempEntry = chemicalEntries.find(entry => entry.material === "Temp. °C");
      if (tempEntry) {
        tempEntry.corrosion_ratings.forEach((rating, index) => {
          const key = `${rating.concentration}-${rating.temperature}`;
          temperatureInfo[key] = rating.rating;
        });
      }
    }
    
    chemicalEntries.forEach(entry => {
      entry.corrosion_ratings.forEach((rating, columnIndex) => {
        if (rating.rating && entry.material !== "Temp. °C") { // 등급이 있고 온도 행이 아닌 것만 포함
          let concentration = '';
          let temperature = '';
          
          if (isMultipleChemicals) {
            // 혼합 화학물질의 경우: concentration = 첫번째 화학물질 농도, temperature = 두번째 화학물질 농도
            const firstChemical = selectedChemical.split('+')[0].trim();
            const secondChemical = selectedChemical.split('+')[1].trim();
            
            const tempKey = `${rating.concentration}-${rating.temperature}`;
            const actualTemperature = temperatureInfo[tempKey] || 'N/A';
            
            concentration = `${firstChemical} ${rating.concentration}% + ${secondChemical} ${rating.temperature}%`;
            temperature = actualTemperature;
          } else {
            // 단일 화학물질의 경우: concentration = 농도, temperature = 온도
            concentration = `${rating.concentration}%`;
            temperature = rating.temperature;
          }
          
          // 등급 필터링 적용
          if (selectedRating === "all" || !selectedRating || rating.rating === selectedRating) {
            results.push({
              material: entry.material,
              concentration: concentration,
              temperature: temperature,
              rating: rating.rating, // 실제 등급 사용
              cell_class: rating.cell_class
            });
          }
        }
      });
    });
    
    return results.sort((a, b) => a.material.localeCompare(b.material));
  }, [selectedChemical, selectedRating, data.corrosion_data]);

  // 호환성 결과가 변경될 때마다 동적 폭 계산
  useEffect(() => {
    if (compatibilityResults.length > 0) {
      calculateOptimalWidths(compatibilityResults);
    }
  }, [compatibilityResults]);

  // 특정 화학물질-재질 조합의 호환성
  const specificCompatibility = useMemo(() => {
    if (!selectedChemical || !selectedMaterial) return null;
    
    const entry = data.corrosion_data.find(
      e => e.chemical === selectedChemical && e.material === selectedMaterial
    );
    
    return entry || null;
  }, [selectedChemical, selectedMaterial, data.corrosion_data]);

  // 호환성 검색 함수
  const searchCompatibility = (chemical: string, material?: string) => {
    const filteredResults: CompatibilityResult[] = [];
    
    const chemicalEntries = data.corrosion_data.filter(entry => {
      const chemicalMatch = entry.chemical.toLowerCase().includes(chemical.toLowerCase());
      const materialMatch = material ? entry.material.toLowerCase().includes(material.toLowerCase()) : true;
      return chemicalMatch && materialMatch && entry.material !== "Grade or type of alloy:";
    });
    
    if (chemicalEntries.length === 0) {
      setResults([]);
      return;
    }
    
    const isMultipleChemicals = chemical.includes('+');
    
    // 온도 정보 추출 (혼합 화학물질의 경우)
    let temperatureInfo: { [key: string]: string } = {};
    if (isMultipleChemicals) {
      const tempEntry = chemicalEntries.find(entry => entry.material === "Temp. °C");
      if (tempEntry) {
        tempEntry.corrosion_ratings.forEach((rating, index) => {
          const key = `${rating.concentration}-${rating.temperature}`;
          temperatureInfo[key] = rating.rating;
        });
      }
    }
    
    chemicalEntries.forEach(entry => {
      entry.corrosion_ratings.forEach((rating, columnIndex) => {
        if (rating.rating && entry.material !== "Temp. °C") { // 등급이 있고 온도 행이 아닌 것만 포함
          let concentration = '';
          let temperature = '';
          
          if (isMultipleChemicals) {
            // 혼합 화학물질의 경우
            const firstChemical = chemical.split('+')[0].trim();
            const secondChemical = chemical.split('+')[1].trim();
            
            const tempKey = `${rating.concentration}-${rating.temperature}`;
            const actualTemperature = temperatureInfo[tempKey] || 'N/A';
            
            concentration = `${firstChemical} ${rating.concentration}% + ${secondChemical} ${rating.temperature}%`;
            temperature = actualTemperature;
          } else {
            // 단일 화학물질의 경우
            concentration = `${rating.concentration}%`;
            temperature = rating.temperature;
          }
          
          // 등급 필터링 적용
          if (!selectedRating || rating.rating === selectedRating) {
            filteredResults.push({
              material: entry.material,
              concentration: concentration,
              temperature: temperature,
              rating: rating.rating, // 실제 등급 사용
              cell_class: rating.cell_class
            });
          }
        }
      });
    });
    
    setResults(filteredResults);
  };

  // 텍스트 조각들을 적절한 등급 코드로 변환하는 함수
  const normalizeRating = (rating: string): string => {
    if (!rating || rating.trim() === '') return '';
    
    const normalizedRating = rating.toLowerCase().trim();
    
    // 텍스트 조각들을 적절한 등급 코드로 매핑
    if (normalizedRating.includes('risk of pitting') || 
        normalizedRating.includes('pitting') ||
        normalizedRating.includes('stainless steels') ||
        normalizedRating.includes('in presence') ||
        normalizedRating.includes('of moisture') ||
        normalizedRating.includes('corrosion of')) {
      return 'p'; // 공식 위험
    }
    
    if (normalizedRating.includes('stress corrosion') ||
        normalizedRating.includes('cracking')) {
      return 's'; // 응력 부식 균열 위험
    }
    
    if (normalizedRating.includes('crevice') ||
        normalizedRating.includes('틈새')) {
      return 'c'; // 틈새 부식 위험
    }
    
    if (normalizedRating.includes('intergranular') ||
        normalizedRating.includes('입계')) {
      return 'ig'; // 입계 부식 위험
    }
    
    if (normalizedRating.includes('boiling') ||
        normalizedRating.includes('bp') ||
        normalizedRating === 'bp') {
      return 'BP'; // 끓는 용액
    }
    
    if (normalizedRating.includes('no data') ||
        normalizedRating.includes('nd') ||
        normalizedRating === 'nd') {
      return 'ND'; // 데이터 없음
    }
    
    if (normalizedRating === '0ps') {
      return '0';
    }
    if (normalizedRating === '0p') {
      return '0';
    }
    if (normalizedRating === '1ps') {
      return '1';
    }
    if (normalizedRating === '1p') {
      return '1';
    }
    
    // 숫자 등급 (0, 1, 2) 또는 기존 문자 등급 (p, c, s, ig 등)은 그대로 반환
    if (/^[0-2]$/.test(normalizedRating) || 
        /^[pcsig]+$/i.test(normalizedRating) ||
        normalizedRating === 'bp' ||
        normalizedRating === 'nd') {
      return rating.toUpperCase();
    }
    
    // 알 수 없는 텍스트는 빈 문자열로 반환 (표시하지 않음)
    return '';
  };

  // 등급별 색상 및 아이콘 반환
  const getRatingInfo = (rating: string) => {
    const normalizedRating = normalizeRating(rating);
    
    // Alleima 등급 시스템에 따른 색상 및 아이콘 매핑
    switch (normalizedRating) {
      case '0':
        return { color: 'bg-green-500', icon: CheckCircle, description: '부식 속도 0.1mm/년 미만. 재료는 부식 방지됩니다.' };
      case '1':
        return { color: 'bg-yellow-500', icon: AlertTriangle, description: '부식 속도 0.1-1.0mm/년. 재료는 부식 방지되지 않지만 특정 경우에는 유용합니다.' };
      case '2':
        return { color: 'bg-red-500', icon: XCircle, description: '부식 속도 1.0mm/년 초과. 심각한 부식. 재료는 사용할 수 없습니다.' };
      case 'P':
      case 'C':
      case 'S':
      case 'IG':
        return { color: 'bg-white border border-gray-300', icon: Info, description: getRatingDescription(normalizedRating) };
      case 'BP':
        return { color: 'bg-white border border-gray-300', icon: Droplet, description: '끓는 용액' };
      case 'ND':
        return { color: 'bg-white border border-gray-300', icon: Info, description: '데이터 없음' };
      default:
        return { color: 'bg-white border border-gray-300', icon: Info, description: '' };
    }
  };
  
  // 등급별 설명 반환
  const getRatingDescription = (rating: string) => {
    switch (rating) {
      case '0':
        return 'Corrosion rate less than 0.1 mm/year. The material is corrosion proof.';
      case '1':
        return 'Corrosion rate 0.1–1.0 mm/year. The material is not corrosion proof, but useful in certain cases.';
      case '2':
        return 'Corrosion rate over 1.0 mm/year. Serious corrosion. The material is not usable.';
        case 'P':
        case 'p':
          return 'Risk : pitting, crevice corrosion';
        case 'PS':
        case 'ps':
          return 'Risk : pitting, crevice corrosion, SCC';
        case 'C':
        case 'c':
          return 'Risk : crevice corrosion';
        case 'S':
        case 's':
          return 'Risk : stress corrosion cracking';
        case 'IG':
        case 'ig':
          return 'Risk : intergranular corrosion';
      case 'BP':
        return 'Boiling solution.';
      case 'ND':
        return 'No data.';
      default:
        return '';
    }
  };
  
  const getDetailedRatingDescription = (combinedRating: string) => {
    if (!combinedRating) return '';
  
    // 등급이 순수하게 숫자로만 구성되어 있는지 확인
    if (/^\d+$/.test(combinedRating)) {
      return ''; // 순수 숫자 등급은 셀 클래스에 표시하지 않음
    }
  
    // 'ps'와 같은 복합 등급을 단일 항목으로 처리 (대소문자 구분 없이)
    const lowerRating = combinedRating.toLowerCase();
    if (lowerRating === 'ps' || lowerRating.includes('ps')) {
      return 'Risk : pitting, crevice corrosion, SCC';
    }

    const descriptions: string[] = [];
    let currentNumericPart = '';
  
    for (let i = 0; i < combinedRating.length; i++) {
      const char = combinedRating[i];
      if (/[0-9]/.test(char)) {
        currentNumericPart += char;
      } else if (/[a-zA-Z]/.test(char)) {
        // 숫자 부분 이후에 나오는 문자 등급만 처리
        const desc = getRatingDescription(char.toUpperCase());
        if (desc) descriptions.push(desc);
      }
    }
    return descriptions.join(', ');
  };
  
  const getRatingBadge = (rating: string) => {
    const ratingInfo = getRatingInfo(rating);
    const IconComponent = ratingInfo.icon;
    
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${ratingInfo.color === 'bg-white border border-gray-300' ? 'text-gray-700' : 'text-white'} ${ratingInfo.color}`}>
        <IconComponent className="w-4 h-4 mr-1" />
        {rating}
      </span>
    );
  };

  const handleSearch = () => {
    if (!selectedChemical) {
      alert('화학물질을 선택해주세요.');
      return;
    }
    searchCompatibility(selectedChemical, selectedMaterial);
  };

  return (
    <div className="space-y-6">


      {/* 검색 섹션 */}
      <div className="mt-6 rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
            <h2 className="text-2xl font-semibold leading-none tracking-tight">Material Corrosion Compatibility</h2>
          </div>
        </div>
        <div className="p-6 pt-0">
            
        <div className="flex items-end gap-3 mt-2 mb-2">
          {/* 화학물질 선택 */}
          <div className="w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2 sr-only">
              화학물질 선택
            </label>
            <Select value={selectedChemical} onValueChange={setSelectedChemical}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="화학물질을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {availableChemicals.map((chemical) => (
                  <SelectItem key={chemical} value={chemical}>
                    {chemical}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        
          {/* 재질 선택 */}
          <div className="w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2 sr-only">
              재질 선택
            </label>
            <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="재질을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {availableMaterials.map((material) => (
                  <SelectItem key={material} value={material}>
                    {material}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* 호환성 등급 필터 */}
          <div className="w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2 sr-only">
              모든 등급
            </label>
            <Select value={selectedRating} onValueChange={setSelectedRating}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="모든 등급" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 등급</SelectItem>
                {availableRatings.map((rating) => (
                  <SelectItem key={rating} value={rating}>
                    {rating}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 조회 버튼 */}
          <div className="ml-auto">
            <button
              onClick={handleSearch}
              className="w-[120px] bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              호환성 조회
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* 특정 재질 선택시 결과 */}
      {selectedChemical && selectedMaterial && specificCompatibility && (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedChemical} × {selectedMaterial} 호환성 결과
          </h3>
          {specificCompatibility.corrosion_ratings.length > 0 ? (
            <div className="space-y-4">
              {specificCompatibility.corrosion_ratings
                .filter(rating => rating.rating) // 등급이 있는 것만 표시
                .map((rating, index) => {
                  const isMultipleChemicals = selectedChemical.includes('+');
                  let concentration = '';
                  let temperature = '';
                  let actualRating = rating.rating;
                  
                  if (isMultipleChemicals) {
                    // 혼합 화학물질의 경우
                    const firstChemical = selectedChemical.split('+')[0].trim();
                    const secondChemical = selectedChemical.split('+')[1].trim();
                    
                    concentration = `${firstChemical} ${rating.concentration}% + ${secondChemical} ${rating.temperature}%`;
                    
                    // 온도 정보 찾기
                    const tempEntry = data.corrosion_data.find(entry => 
                      entry.chemical === selectedChemical && entry.material === "Temp. °C"
                    );
                    
                    if (tempEntry) {
                      const tempRating = tempEntry.corrosion_ratings.find(r => 
                        r.concentration === rating.concentration && r.temperature === rating.temperature
                      );
                      if (tempRating) {
                        temperature = tempRating.rating;
                      }
                    }
                    
                    if (!temperature) {
                      temperature = 'N/A';
                    }
                  } else {
                    // 단일 화학물질의 경우
                    concentration = `${rating.concentration}%`;
                    temperature = rating.temperature;
                  }
                  
                  return (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm text-gray-600 mb-1">농도</div>
                          <div className="font-medium">{concentration}</div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm text-gray-600 mb-1">온도 (°C)</div>
                          <div className="font-medium">{temperature}</div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm text-gray-600 mb-1">호환성 등급</div>
                          <div className="flex items-center gap-2">
                            {getRatingBadge(actualRating)}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm text-gray-600 mb-1">비고</div>
                          <div className="font-medium">
                            {getDetailedRatingDescription(actualRating) ? (
                              <span dangerouslySetInnerHTML={{ __html: getDetailedRatingDescription(actualRating) }} />
                            ) : (
                              '-'
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <div className="text-sm text-blue-800">
                          <strong>등급 설명:</strong> {getRatingInfo(actualRating).description}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-8 text-black">
              해당 조합에 대한 호환성 데이터가 없습니다.
            </div>
          )}
        </div>
      )}

      {/* 전체 재질 호환성 결과 테이블 */}
      {selectedChemical && !selectedMaterial && compatibilityResults.length > 0 && (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedChemical} 호환성 결과
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`${dynamicWidths.material} px-6 py-2 text-center text-sm font-semibold text-black uppercase tracking-wider`}>
                    재질명
                  </th>
                  <th className={`${dynamicWidths.concentration} px-6 py-2 text-center text-sm font-semibold text-black uppercase tracking-wider whitespace-nowrap`}>
                    농도
                  </th>
                  <th className={`${dynamicWidths.temperature} px-6 py-2 text-center text-sm font-semibold text-black uppercase tracking-wider`}>
                    온도 (°C)
                  </th>
                  <th className={`${dynamicWidths.rating} px-6 py-2 text-center text-sm font-semibold text-black uppercase tracking-wider`}>
                    호환성 등급
                  </th>
                  <th className={`${dynamicWidths.remarks} px-6 py-2 text-center text-sm font-semibold text-black uppercase tracking-wider`}>
                    비고
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {compatibilityResults.map((result, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className={`${dynamicWidths.material} px-4 py-2 text-sm font-medium text-gray-900`}>
                      {result.material}
                    </td>
                    <td className={`${dynamicWidths.concentration} px-4 py-2 text-sm text-black whitespace-nowrap`}>
                      {result.concentration}
                    </td>
                    <td className={`${dynamicWidths.temperature} px-4 py-2 text-sm text-black`}>
                      {result.temperature}
                    </td>
                    <td className={`${dynamicWidths.rating} px-4 py-2 text-sm text-black`}>
                      {getRatingBadge(result.rating)}
                    </td>
                    <td className={`${dynamicWidths.remarks} px-4 py-2 text-sm text-black whitespace-nowrap`}>
                      {getDetailedRatingDescription(result.rating) ? (
                        <span dangerouslySetInnerHTML={{ __html: getDetailedRatingDescription(result.rating) }} />
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 결과가 없을 때 메시지 */}
      {selectedChemical && !selectedMaterial && compatibilityResults.length === 0 && (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="text-center py-8">
            <Info className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">호환성 데이터가 없습니다</h3>
            <p className="text-gray-500">
              선택하신 화학물질 &ldquo;{selectedChemical}&rdquo;에 대한 호환성 데이터를 찾을 수 없습니다.
            </p>
          </div>
        </div>
      )}

      {/* 검색 결과 */}
      {results.length > 0 && (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">호환성 조회 결과</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-sm font-semibold text-black uppercase tracking-wider w-1/6">
                    재질명
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-black uppercase tracking-wider w-1/4">
                    농도
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-black uppercase tracking-wider w-1/12">
                    온도 (°C)
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-black uppercase tracking-wider w-1/8">
                    호환성 등급
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-black uppercase tracking-wider w-5/12">
                    셀 클래스
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.map((result, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="w-1/6 px-4 py-2 text-sm font-medium text-gray-900">
                        {result.material}
                      </td>
                      <td className="w-1/4 px-4 py-2 whitespace-nowrap text-sm text-black">
                        {result.concentration}
                      </td>
                      <td className="w-1/12 px-4 py-2 text-sm text-black">
                        {result.temperature}
                      </td>
                      <td className="w-1/8 px-4 py-2">
                        {getRatingBadge(result.rating)}
                      </td>
                      <td className="w-5/12 px-4 py-2 text-sm text-black whitespace-nowrap">
                        {getDetailedRatingDescription(result.cell_class.join(''))}
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 호환성 등급 설명 */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">호환성 등급 설명</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {Object.entries(data.symbol_clarification).map(([symbol, description]) => (
            <div key={symbol} className="flex items-center space-x-2">
              {getRatingBadge(symbol)}
              <p className="text-sm text-gray-700">{description}</p>
            </div>
          ))}
        </div>
        

      </div>
    </div>
  );
};

export default CorrosionCompatibility;