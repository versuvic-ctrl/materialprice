'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, AlertTriangle, CheckCircle, XCircle, Info, ChevronDown, Droplet } from 'lucide-react';
import alleimaCorrosionData from '@/data/alleima_corrosion_data_full.json';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

console.log('Full alleimaCorrosionData:', alleimaCorrosionData);
console.log('Length of corrosion_data array:', (alleimaCorrosionData as AlleimaCorrosionData).corrosion_data.length);

interface CorrosionRating {
  concentrations: {
    concentration_1?: {
      chemical: string;
      value: string;
    };
    concentration_2?: {
      chemical: string;
      value: string;
    };
    concentration_3?: {
      chemical: string;
      value: string;
    };
  };
  temperature: string;
  rating: string;
  cell_class: string[];
}

interface CompatibilityResult {
  material: string;
  concentration: string; // 농도 정보 (단일 화학물질용)
  concentration1?: string; // 첫 번째 화학물질 농도 (혼합 화학물질용)
  concentration2?: string; // 두 번째 화학물질 농도 (혼합 화학물질용)
  concentration3?: string; // 세 번째 화학물질 농도 (3개 이상 혼합 화학물질용)
  concentrations?: string[]; // 다중 화학물질 농도 배열 (3개 이상)
  chemicalNames?: string[]; // 화학물질 이름 배열
  temperature: string;   // 온도 정보
  rating: string;
  cell_class: string[];
  isMultipleChemicals?: boolean; // 혼합 화학물질 여부
  chemicalCount?: number; // 화학물질 개수
}

interface CorrosionDataEntry {
  chemical: string;
  chemical_url: string;
  chemical_formulas: { [key: string]: string };
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

  // 다중 화학물질 조합의 농도 매핑 데이터
  const multiChemicalConcentrations: { [key: string]: { chemicals: string[], concentrations: string[], temperature: string } } = {
    "Boric acid + nickel + sulphate hydrochloric acid": {
      chemicals: ["B(OH)₃", "NiSO₄", "HCl"],
      concentrations: ["1.5%", "25%", "0.2%"],
      temperature: "80"
    }
    // 추후 다른 다중 화학물질 조합 추가 가능
  };

  // 재질 우선순위 정의
  const materialPriority = [
  'Carbon Steel',
  'Carbon steel',
    'Alleima® 3R12',
    'Alleima® 3R60',
    'Alleima® 3R64'
  ];

  // 재질 정렬 함수
  const sortMaterialsByPriority = (materials: string[]): string[] => {
    return materials.sort((a, b) => {
      const aIndex = materialPriority.findIndex(priority => 
        a.includes(priority) || priority.includes(a)
      );
      const bIndex = materialPriority.findIndex(priority => 
        b.includes(priority) || priority.includes(b)
      );

      // 우선순위에 있는 재질들
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // a만 우선순위에 있는 경우
      if (aIndex !== -1 && bIndex === -1) {
        return -1;
      }
      
      // b만 우선순위에 있는 경우
      if (aIndex === -1 && bIndex !== -1) {
        return 1;
      }
      
      // 둘 다 우선순위에 없는 경우 알파벳 순
      return a.localeCompare(b);
    });
  };

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
    const isValidRating = (rating: string): boolean => {
      if (!rating || rating.trim() === '') return false;
      const trimmedRating = rating.trim();
      if (/^[0-2]$/.test(trimmedRating)) return true;
      if (/^[0-2][pcsig]+$/i.test(trimmedRating)) return true;
      if (/^(BP|ND)$/i.test(trimmedRating)) return true;
      if (/^(p|c|s|ig)$/i.test(trimmedRating)) return true;
      if (/^[pcsig]{2,4}$/i.test(trimmedRating)) return true;
      return false;
    };

    let sourceData = data.corrosion_data;

    if (selectedChemical) {
      sourceData = sourceData.filter(entry => entry.chemical === selectedChemical);
    }

    if (selectedMaterial && selectedMaterial !== "모든 재질") {
      sourceData = sourceData.filter(entry => entry.material === selectedMaterial);
    }

    const ratings = [...new Set(sourceData
      .flatMap(entry => entry.corrosion_ratings)
      .map(rating => rating.rating)
      .filter(isValidRating)
    )];

    const sortedRatings = ratings.sort((a, b) => {
      const aNum = a.match(/^(\d)/);
      const bNum = b.match(/^(\d)/);

      if (aNum && bNum) {
        const aNumVal = parseInt(aNum[1]);
        const bNumVal = parseInt(bNum[1]);
        if (aNumVal !== bNumVal) {
          return aNumVal - bNumVal;
        }
        return a.localeCompare(b);
      }

      if (aNum && !bNum) return -1;
      if (!aNum && bNum) return 1;

      return a.localeCompare(b);
    });

    return sortedRatings;
  }, [data.corrosion_data, selectedChemical, selectedMaterial]);

  // 화학물질 목록 추출 (중복 제거)
  const availableChemicals = useMemo(() => {
    const chemicalNames = [...new Set(data.chemical_links.map(entry => entry.name))];
    console.log('Number of available chemicals:', chemicalNames.length);
    return chemicalNames.sort();
  }, [data.chemical_links]);

  const materialNameMap: { [key: string]: string } = {
    "Alleima® 3R12": "Alleima® 3R12 ('304L')",
    "Alleima® 3R60": "Alleima® 3R60 ('316L')",
    "Alleima® 3R64": "Alleima® 3R64 ('317L')",
  };

  // 화학물질 제목에 화학식을 포함하는 헬퍼 함수
  const getChemicalTitleWithFormulas = (chemicalName: string): string => {
    if (!chemicalName) return '';
    
    // 일반적인 화학식 매핑 (데이터에 없는 경우 사용)
    const commonFormulas: { [key: string]: string } = {
      'sodium chloride': 'NaCl',
      'sodium hydroxide': 'NaOH',
      'hydrogen sulphide': 'H2S',
      'carbon disulphide': 'CS2',
      'acetic acid': 'CH3COOH',
      'formic acid': 'HCOOH',
      'hydrochloric acid': 'HCl',
      'sulfuric acid': 'H2SO4',
      'nitric acid': 'HNO3',
      'phosphoric acid': 'H3PO4',
      'ammonia': 'NH3',
      'sodium carbonate': 'Na2CO3',
      'potassium hydroxide': 'KOH',
      'calcium chloride': 'CaCl2',
      'magnesium chloride': 'MgCl2',
      'zinc chloride': 'ZnCl2',
      'ferric chloride': 'FeCl3',
      'aluminum chloride': 'AlCl3'
    };
    
    // 화학물질 이름을 정규화하는 함수
    const normalizeChemicalName = (name: string): string => {
      return name.toLowerCase().trim()
        .replace(/\s+/g, ' ')
        .replace(/[()]/g, '');
    };
    
    // 화학식을 찾는 함수
    const findFormula = (chemicalName: string, chemicalEntry: any): string | null => {
      const normalizedChemicalName = normalizeChemicalName(chemicalName);

      // 1. chemical_formulas에서 찾기
      if (chemicalEntry?.chemical_formulas && Object.keys(chemicalEntry.chemical_formulas).length > 0) {
        for (const [key, value] of Object.entries(chemicalEntry.chemical_formulas)) {
          const normalizedKey = normalizeChemicalName(key);
          if (normalizedKey === normalizedChemicalName || 
              normalizedKey.includes(normalizedChemicalName) || 
              normalizedChemicalName.includes(normalizedKey)) {
            return value as string;
          }
        }
      }

      // 2. chemical_formulas가 비어있고, 현재 chemicalEntry의 주 화학물질인 경우 concentrations에서 찾기
      if ((!chemicalEntry?.chemical_formulas || Object.keys(chemicalEntry.chemical_formulas).length === 0) && 
          normalizeChemicalName(chemicalEntry?.chemical) === normalizedChemicalName) {
        if (chemicalEntry?.corrosion_ratings) {
          for (const rating of chemicalEntry.corrosion_ratings) {
            if (rating.concentrations) {
              for (const key in rating.concentrations) {
                const conc = rating.concentrations[key];
                if (conc && conc.chemical) {
                  return conc.chemical; // concentrations의 chemical 필드를 바로 반환
                }
              }
            }
          }
        }
      }
      
      // 3. 일반적인 화학식 매핑에서 찾기
      for (const [commonName, formula] of Object.entries(commonFormulas)) {
        if (normalizedChemicalName.includes(commonName) || commonName.includes(normalizedChemicalName)) {
          return formula;
        }
      }
      
      return null;
    };
    
    // 혼합 화학물질인 경우
    if (chemicalName.includes('+')) {
      const chemicalParts = chemicalName.split('+').map(part => part.trim());
      
      // 해당 화학물질의 데이터에서 화학식 정보 찾기
      const chemicalEntry = data.corrosion_data.find(entry => entry.chemical === chemicalName);
      
      const formattedParts = chemicalParts.map(part => {
        const formula = findFormula(part, chemicalEntry);
        return formula ? `${part}(${formula})` : part;
      });
      
      return formattedParts.join(' + ');
    } else {
      // 단일 화학물질인 경우
      const chemicalEntry = data.corrosion_data.find(entry => entry.chemical === chemicalName);
      const formula = findFormula(chemicalName, chemicalEntry);
      
      return formula ? `${chemicalName}(${formula})` : chemicalName;
    }
  };

  // 재질 목록 추출 (중복 제거, "Grade or type of alloy:" 제외)
  const availableMaterials = useMemo(() => {
    const materials = new Set<string>();
    
    let sourceData = data.corrosion_data;

    if (selectedChemical) {
      sourceData = data.corrosion_data.filter(entry => entry.chemical === selectedChemical);
    }

    sourceData.forEach(item => {
      if (item.material && item.material !== "Grade or type of alloy:") {
        materials.add(item.material);
      }
    });
    const sortedBaseMaterials = sortMaterialsByPriority(Array.from(materials));
    const sortedFullMaterials = sortedBaseMaterials.map(m => materialNameMap[m] || m);
    return ["모든 재질", ...sortedFullMaterials];
  }, [data.corrosion_data, selectedChemical]);

  // 선택된 화학물질에 대한 호환성 결과 (모든 재질의 모든 등급)
  const compatibilityResults = useMemo(() => {
    if (!selectedChemical) return [];

    const allResults: CompatibilityResult[] = [];
    const chemicalEntries = data.corrosion_data.filter(e => e.chemical === selectedChemical);
    const isMultipleChemicals = selectedChemical.includes('+');

    // 온도 정보 추출 (혼합 화학물질의 경우)
    let temperatureInfo: { [key: string]: string } = {};
    if (isMultipleChemicals) {
      const tempEntry = chemicalEntries.find(entry => entry.material === "Temp. °C");
      if (tempEntry) {
        tempEntry.corrosion_ratings.forEach((rating, index) => {
          const conc1 = rating.concentrations.concentration_1?.value || '';
          const conc2 = rating.concentrations.concentration_2?.value || '';
          const key = `${conc1}-${conc2}`;
          temperatureInfo[key] = rating.rating;
        });
      }
    }

    chemicalEntries.forEach(entry => {
      entry.corrosion_ratings.forEach(rating => {
        if (rating.rating && entry.material !== "Temp. °C" && !entry.material.startsWith("Conc.")) { // 등급이 있고 온도/농도 행이 아닌 것만 포함
          if (isMultipleChemicals) {
            const conc1 = rating.concentrations.concentration_1?.value || '';
            const conc2 = rating.concentrations.concentration_2?.value || '';
            const chem1 = rating.concentrations.concentration_1?.chemical || '';
            const chem2 = rating.concentrations.concentration_2?.chemical || '';
            
            // 화학물질 공식을 사용하여 표시명 생성
            const chem1Display = entry.chemical_formulas ? 
              Object.keys(entry.chemical_formulas).find(key => entry.chemical_formulas[key] === chem1) || chem1 : chem1;
            const chem2Display = entry.chemical_formulas ? 
              Object.keys(entry.chemical_formulas).find(key => entry.chemical_formulas[key] === chem2) || chem2 : chem2;

            allResults.push({
              material: entry.material,
              concentration: `${chem1Display} ${conc1}% + ${chem2Display} ${conc2}%`,
              concentration1: `${conc1}%`,
              concentration2: `${conc2}%`,
              temperature: rating.temperature,
              rating: rating.rating,
              cell_class: rating.cell_class,
              isMultipleChemicals: true
            });
          } else {
            const conc1 = rating.concentrations.concentration_1?.value || '';
            allResults.push({
              material: entry.material,
              concentration: `${conc1}%`,
              temperature: rating.temperature,
              rating: rating.rating,
              cell_class: rating.cell_class,
              isMultipleChemicals: false
            });
          }
        }
      });
    });

    // 재질 필터링 로직 추가
    let filteredByMaterial = allResults;
    if (selectedMaterial && selectedMaterial !== "모든 재질") {
      filteredByMaterial = allResults.filter(result => result.material === selectedMaterial);
    }

    // 등급 필터링
    let filteredByRating = filteredByMaterial;
    if (selectedRating && selectedRating !== 'all') {
      filteredByRating = filteredByMaterial.filter(result => result.rating === selectedRating);
    }

    // 재질별로 그룹화하고 정렬
    const grouped = filteredByRating.reduce((acc, curr) => {
      const key = curr.material;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(curr);
      return acc;
    }, {} as Record<string, CompatibilityResult[]>);

    const sortedResults: CompatibilityResult[] = [];
    sortMaterialsByPriority(Object.keys(grouped)).forEach(material => {
      sortedResults.push(...grouped[material]);
    });

    return sortedResults;
  }, [selectedChemical, selectedMaterial, selectedRating, data.corrosion_data]);

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

    const chemicalEntries = (alleimaCorrosionData as AlleimaCorrosionData).corrosion_data.filter(entry => {
      const chemicalMatch = entry.chemical.toLowerCase().includes(chemical.toLowerCase());
      const materialMatch = material ? entry.material.toLowerCase().includes(material.toLowerCase()) : true;
      
      // 농도 정보 행들을 필터링 (실제 재질이 아닌 것들)
      const isConcentrationInfo = entry.material.startsWith("Conc.") || 
                                  entry.material === "Grade or type of alloy:" ||
                                  entry.material === "Temp. °C";
      
      return chemicalMatch && materialMatch && !isConcentrationInfo;
    });

    if (chemicalEntries.length === 0) {
      setResults([]);
      return;
    }

    const isMultipleChemicals = chemical.includes('+');
    const chemicalParts = chemical.split('+').map(part => part.trim());
    const chemicalCount = chemicalParts.length;

    chemicalEntries.forEach(entry => {
      entry.corrosion_ratings.forEach((rating: any, columnIndex: number) => {
        if (rating.rating && entry.material !== "Temp. °C" && !entry.material.startsWith("Conc.")) {
          let concentration = '';
          let concentration1 = '';
          let concentration2 = '';
          let concentration3 = '';
          let concentrations: string[] = [];
          let chemicalNames: string[] = [];

          if (isMultipleChemicals) {
            if (chemicalCount === 2) {
              // 2개 화학물질 조합
              const conc1 = rating.concentrations.concentration_1;
              const conc2 = rating.concentrations.concentration_2;
              
              if (conc1 && conc2) {
                // 농도 값 포맷팅 (특수 값은 % 붙이지 않음)
                const formatConcentration = (value: string) => {
                  const specialValues = ['saturated', 'bp', 'boiling', 'sat', 'concentrated'];
                  return specialValues.some(special => value.toLowerCase().includes(special)) ? value : `${value}%`;
                };
                
                concentration1 = formatConcentration(conc1.value);
                concentration2 = formatConcentration(conc2.value);
                concentration = `${chemicalParts[0]} ${concentration1} + ${chemicalParts[1]} ${concentration2}`;
                concentrations = [concentration1, concentration2];
                chemicalNames = chemicalParts;
              }
            } else if (chemicalCount >= 3) {
              // 3개 이상 화학물질 조합
              const conc1 = rating.concentrations.concentration_1;
              const conc2 = rating.concentrations.concentration_2;
              const conc3 = rating.concentrations.concentration_3;
              
              if (conc1 && conc2 && conc3) {
                // 농도 값 포맷팅 (특수 값은 % 붙이지 않음)
                const formatConcentration = (value: string) => {
                  const specialValues = ['saturated', 'bp', 'boiling', 'sat', 'concentrated'];
                  return specialValues.some(special => value.toLowerCase().includes(special)) ? value : `${value}%`;
                };
                
                concentration1 = formatConcentration(conc1.value);
                concentration2 = formatConcentration(conc2.value);
                concentration3 = formatConcentration(conc3.value);
                concentration = `${chemicalParts[0]} ${concentration1} + ${chemicalParts[1]} ${concentration2} + ${chemicalParts[2]} ${concentration3}`;
                concentrations = [concentration1, concentration2, concentration3];
                chemicalNames = chemicalParts;
              }
            }

            // 등급 필터링 적용
            if (!selectedRating || rating.rating === selectedRating) {
              const result: CompatibilityResult = {
                material: entry.material,
                concentration: concentration,
                concentration1: concentration1,
                concentration2: concentration2,
                concentration3: concentration3,
                concentrations: concentrations,
                chemicalNames: chemicalNames,
                temperature: rating.temperature,
                rating: rating.rating,
                cell_class: rating.cell_class,
                isMultipleChemicals: true,
                chemicalCount: chemicalCount
              };

              filteredResults.push(result);
            }
          } else {
            // 단일 화학물질의 경우
            const conc1 = rating.concentrations.concentration_1;
            if (conc1) {
              concentration = `${conc1.value}%`;
            }

            // 등급 필터링 적용
            if (!selectedRating || rating.rating === selectedRating) {
              filteredResults.push({
                material: entry.material,
                concentration: concentration,
                temperature: rating.temperature,
                rating: rating.rating,
                cell_class: rating.cell_class,
                isMultipleChemicals: false,
                chemicalCount: 1
              });
            }
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
        return { color: 'bg-green-500', icon: CheckCircle, description: getKoreanRatingDescription('0') };
      case '1':
        return { color: 'bg-yellow-500', icon: AlertTriangle, description: getKoreanRatingDescription('1') };
      case '2':
        return { color: 'bg-red-500', icon: XCircle, description: getKoreanRatingDescription('2') };
      case 'P':
      case 'C':
      case 'S':
      case 'IG':
        return { color: 'bg-white border border-gray-300', icon: Info, description: getKoreanRatingDescription(normalizedRating) };
      case 'BP':
        return { color: 'bg-white border border-gray-300', icon: Droplet, description: getKoreanRatingDescription('BP') };
      case 'ND':
        return { color: 'bg-white border border-gray-300', icon: Info, description: getKoreanRatingDescription('ND') };
      default:
        return { color: 'bg-white border border-gray-300', icon: Info, description: '' };
    }
  };
  
  const getKoreanRatingDescription = (rating: string): string => {
    const symbols = rating.split(',').map(s => s.trim());
    for (const symbol of symbols) {
      switch (symbol) {
        case '0':
          return '부식 속도 0.1mm/년 미만. <부식 방지 가능>';
        case '1':
          return '부식 속도 0.1–1.0mm/년. <특정 경우 가능>';
        case '2':
          return '부식 속도 1.0mm/년 초과. <심각한 부식>';
        case 'P':
        case 'p':
          return '위험: 공식, 틈새 부식';
        case 'PS':
        case 'ps':
          return '위험: 공식, 틈새 부식, 응력 부식 균열';
        case 'C':
        case 'c':
          return '위험: 틈새 부식';
        case 'S':
        case 's':
          return '위험: 응력 부식 균열';
        case 'IG':
        case 'ig':
          return '위험: 입계 부식';
        case 'BP':
          return '끓는 용액.';
        case 'ND':
          return '데이터 없음.';
        default:
          // Continue to check other symbols if any
          break;
      }
    }
    return ''; // If no match found after checking all symbols
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
        <IconComponent className="w-3 h-3 mr-1" />
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
       <div className="text-xs text-gray-500 mt-2 ml-4">
         - 부식 데이터는 실제 수행한 일반 부식 실험실 테스트 결과를 기반으로 합니다. (출처 : Alleima (Sandvik))
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
      {/* 이 섹션은 이제 필요 없으므로 주석 처리하거나 제거할 수 있습니다. */}
      {/* {selectedChemical && selectedMaterial && specificCompatibility && (
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
                    const conc1 = rating.concentrations.concentration_1?.value || '';
                    const conc2 = rating.concentrations.concentration_2?.value || '';
                    
                    // concentration_2가 없는 경우 (예: Acetic acid + formic acid)
                    if (!conc2) {
                      // concentration_1의 chemical 정보를 확인하여 어떤 화학물질의 농도인지 판단
                      const chemical1 = rating.concentrations.concentration_1?.chemical || '';
                      if (chemical1.includes('HCOOH') || chemical1.toLowerCase().includes('formic')) {
                        concentration = `${secondChemical} ${conc1}%`;
                      } else if (chemical1.includes('CH3COOH') || chemical1.toLowerCase().includes('acetic')) {
                        concentration = `${firstChemical} ${conc1}%`;
                      } else {
                        concentration = `${conc1}%`;
                      }
                    } else {
                      concentration = `${firstChemical} ${conc1}% + ${secondChemical} ${conc2}%`;
                    }
                    
                    // 온도 정보는 rating.temperature에서 직접 가져오기
                    temperature = rating.temperature || 'N/A';
                  } else {
                    // 단일 화학물질의 경우
                    const conc1 = rating.concentrations.concentration_1?.value || '';
                    concentration = `${conc1}%`;
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
      )} */}

      {/* 전체 재질 호환성 결과 테이블 */}
      {selectedChemical && compatibilityResults.length > 0 && (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {getChemicalTitleWithFormulas(selectedChemical)} 호환성 결과
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-black">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`${dynamicWidths.material} px-6 py-2 text-center text-sm font-semibold text-black uppercase tracking-wider`}>
                    재질명
                  </th>
                  {selectedChemical && selectedChemical.includes('+') ? (
                    (() => {
                      const chemicalParts = selectedChemical.split('+').map(part => part.trim());
                      const chemicalCount = chemicalParts.length;
                      
                      // 3개 이상의 화학물질인 경우 매핑 데이터에서 화학물질 이름 가져오기
                      if (chemicalCount >= 3) {
                        const multiChemMapping = multiChemicalConcentrations[selectedChemical];
                        if (multiChemMapping) {
                          return multiChemMapping.chemicals.map((chemName, idx) => (
                            <th key={idx} className={`${dynamicWidths.concentration} px-6 py-2 text-center text-sm font-semibold text-black uppercase tracking-wider whitespace-nowrap`}>
                              {chemName} 농도
                            </th>
                          ));
                        }
                      }
                      
                      // 2개 화학물질인 경우 (기존 로직)
                      return chemicalParts.map((chemName, idx) => (
                        <th key={idx} className={`${dynamicWidths.concentration} px-6 py-2 text-center text-sm font-semibold text-black uppercase tracking-wider whitespace-nowrap`}>
                          {chemName} 농도
                        </th>
                      ));
                    })()
                  ) : (
                    <th className={`${dynamicWidths.concentration} px-6 py-2 text-center text-sm font-semibold text-black uppercase tracking-wider whitespace-nowrap`}>
                      농도
                    </th>
                  )}
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
              <tbody className="bg-white divide-y divide-black">
                {compatibilityResults.map((result, index) => {
                  let rowSpan = 1;
                  for (let i = index + 1; i < compatibilityResults.length; i++) {
                    if (compatibilityResults[i].material === result.material) {
                      rowSpan++;
                    } else {
                      break;
                    }
                  }

                  if (index > 0 && compatibilityResults[index - 1].material === result.material) {
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        {result.isMultipleChemicals ? (
                          (() => {
                            if (result.chemicalCount && result.chemicalCount >= 3 && result.concentrations) {
                              // 3개 이상의 화학물질인 경우
                              return result.concentrations.map((conc, idx) => (
                                <td key={idx} className={`${dynamicWidths.concentration} px-4 py-1 text-sm text-black whitespace-nowrap text-center`}>
                                  {conc}
                                </td>
                              ));
                            } else {
                              // 2개 화학물질인 경우 (기존 로직)
                              return (
                                <>
                                  <td className={`${dynamicWidths.concentration} px-4 py-1 text-sm text-black whitespace-nowrap text-center`}>
                                    {result.concentration1}
                                  </td>
                                  <td className={`${dynamicWidths.concentration} px-4 py-1 text-sm text-black whitespace-nowrap text-center`}>
                                    {result.concentration2}
                                  </td>
                                </>
                              );
                            }
                          })()
                        ) : (
                          <td className={`${dynamicWidths.concentration} px-4 py-1 text-sm text-black whitespace-nowrap text-center`}>
                            {result.concentration}
                          </td>
                        )}
                        <td className={`${dynamicWidths.temperature} px-4 py-1 text-sm text-black text-center`}>
                          {result.temperature}
                        </td>
                        <td className={`${dynamicWidths.rating} px-4 py-1 text-sm text-black text-center`}>
                          {getRatingBadge(result.rating)}
                        </td>
                        <td className={`${dynamicWidths.remarks} px-4 py-1 text-sm text-black whitespace-nowrap text-center`}>
                          {getDetailedRatingDescription(result.rating) ? (
                            <span dangerouslySetInnerHTML={{ __html: getDetailedRatingDescription(result.rating) }} />
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td
                        rowSpan={rowSpan}
                        className={`${dynamicWidths.material} px-4 py-1 text-sm font-medium text-gray-900 text-center align-middle`}
                      >
                          {result.material === "Alleima® 3R12" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>Alleima® 3R12 (&apos;304L&apos;) <span className="cursor-pointer text-gray-400 text-sm">ℹ️</span></span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="!bg-white !p-2 !border !border-black !rounded-md !shadow-lg !opacity-100">
                              ASTM : TP304/TP304L
                              UNS : S30400/S30403
                            </TooltipContent>
                          </Tooltip>
                        ) : result.material === "Alleima® 2RK65 ('904L')" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>Alleima® 2RK65 (&apos;904L&apos;) <span className="cursor-pointer text-gray-400 text-sm">ℹ️</span></span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="!bg-white !p-2 !border !border-black !rounded-md !shadow-lg !opacity-100">
                              ASTM : 904L
                              UNS : N08904
                            </TooltipContent>
                          </Tooltip>
                        ) : result.material === "Alleima® 3R64 ('317L')" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>Alleima® 3R64 (&apos;317L&apos;) <span className="cursor-pointer text-gray-400 text-sm">ℹ️</span></span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="!bg-white !p-2 !border !border-black !rounded-md !shadow-lg !opacity-100">
                              ASTM : TP317L
                              UNS : S31703
                            </TooltipContent>
                          </Tooltip>
                        ) : result.material === "Alleima® 3R60" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>Alleima® 3R60 (&apos;316L&apos;) <span className="cursor-pointer text-gray-400 text-sm">ℹ️</span></span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="!bg-white !p-2 !border !border-black !rounded-md !shadow-lg !opacity-100">
                              ASTM : TP316/TP316L
                              UNS : S31600/S31603
                            </TooltipContent>
                          </Tooltip>
                        ) : result.material}
                      </td>
                      {result.isMultipleChemicals ? (
                        (() => {
                          if (result.chemicalCount && result.chemicalCount >= 3 && result.concentrations) {
                            // 3개 이상의 화학물질인 경우
                            return result.concentrations.map((conc, idx) => (
                              <td key={idx} className={`${dynamicWidths.concentration} px-4 py-1 text-sm text-black whitespace-nowrap text-center`}>
                                {conc}
                              </td>
                            ));
                          } else {
                            // 2개 화학물질인 경우 (기존 로직)
                            return (
                              <>
                                <td className={`${dynamicWidths.concentration} px-4 py-1 text-sm text-black whitespace-nowrap text-center`}>
                                  {result.concentration1}
                                </td>
                                <td className={`${dynamicWidths.concentration} px-4 py-1 text-sm text-black whitespace-nowrap text-center`}>
                                  {result.concentration2}
                                </td>
                              </>
                            );
                          }
                        })()
                      ) : (
                        <td className={`${dynamicWidths.concentration} px-4 py-1 text-sm text-black whitespace-nowrap text-center`}>
                          {result.concentration}
                        </td>
                      )}
                      <td className={`${dynamicWidths.temperature} px-4 py-1 text-sm text-black text-center`}>
                        {result.temperature}
                      </td>
                      <td className={`${dynamicWidths.rating} px-4 py-1 text-sm text-black text-center`}>
                        {getRatingBadge(result.rating)}
                      </td>
                      <td className={`${dynamicWidths.remarks} px-4 py-1 text-sm text-black whitespace-nowrap text-center`}>
                        {getDetailedRatingDescription(result.rating) ? (
                          <span dangerouslySetInnerHTML={{ __html: getDetailedRatingDescription(result.rating) }} />
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 결과가 없을 때 메시지 */}
      {selectedChemical && compatibilityResults.length === 0 && (
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
                  {results.length > 0 && results[0].isMultipleChemicals ? (
                    <>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-black uppercase tracking-wider w-1/8">
{selectedChemical.split('+')[0]?.trim()} 농도
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-black uppercase tracking-wider w-1/8">
                        {selectedChemical.split('+')[1]?.trim()} 농도
                      </th>
                    </>
                  ) : (
                    <th className="px-4 py-2 text-left text-sm font-semibold text-black uppercase tracking-wider w-1/4">
                      농도
                    </th>
                  )}
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
                    <td className="w-1/6 px-4 py-2 text-sm font-medium text-gray-900 text-center">
                        {result.material === "SUS304L" ? "SUS304L" : result.material}
                      </td>
                      {result.isMultipleChemicals ? (
                        <>
                          <td className="w-1/8 px-4 py-2 whitespace-nowrap text-sm text-black text-center">
                            {result.concentration1}
                          </td>
                          <td className="w-1/8 px-4 py-2 whitespace-nowrap text-sm text-black text-center">
                            {result.concentration2}
                          </td>
                        </>
                      ) : (
                        <td className="w-1/4 px-4 py-2 whitespace-nowrap text-sm text-black text-center">
                          {result.concentration}
                        </td>
                      )}
                      <td className="w-1/12 px-4 py-2 text-sm text-black text-center">
                        {result.temperature}
                      </td>
                      <td className="w-1/8 px-4 py-2 text-center">
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
              <p className="text-sm text-gray-700">{getKoreanRatingDescription(symbol)}</p>
            </div>
          ))}
        </div>
        

      </div>
    </div>
  );
};

export default CorrosionCompatibility;