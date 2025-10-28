'use client';

import * as React from 'react';
import { useState, useMemo, useEffect, useRef } from 'react';
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

  const [chemicalSearchTerm, setChemicalSearchTerm] = useState<string>(''); // 화학물질 검색어
  const [materialSearchTerm, setMaterialSearchTerm] = useState<string>(''); // 재질 검색어
  const [isChemicalSelectOpen, setIsChemicalSelectOpen] = useState(false);
  const [isMaterialSelectOpen, setIsMaterialSelectOpen] = useState(false);
  
  // 검색 입력 필드 ref
  const chemicalSearchRef = useRef<HTMLInputElement>(null);
  const materialSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isChemicalSelectOpen && chemicalSearchRef.current) {
      const timer = setTimeout(() => {
        if (chemicalSearchRef.current) {
          chemicalSearchRef.current.focus();
        }
      }, 150); // 150ms delay for better stability
      
      return () => clearTimeout(timer);
    }
  }, [isChemicalSelectOpen]);

  useEffect(() => {
    if (isMaterialSelectOpen && materialSearchRef.current) {
      const timer = setTimeout(() => {
        if (materialSearchRef.current) {
          materialSearchRef.current.focus();
        }
      }, 150); // 150ms delay for better stability
      
      return () => clearTimeout(timer);
    }
  }, [isMaterialSelectOpen]);
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
    },
    "Carbon disulphide + sodium hydroxide + hydrogen sulphide": {
      chemicals: ["CS₂", "NaOH", "H₂S"],
      concentrations: ["0.1%", "0.5%", "saturated"],
      temperature: "BP"
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

  // 검색어로 필터링된 화학물질 목록
  const filteredChemicals = useMemo(() => {
    if (!chemicalSearchTerm) return availableChemicals;
    return availableChemicals.filter(chemical =>
      chemical.toLowerCase().includes(chemicalSearchTerm.toLowerCase())
    );
  }, [availableChemicals, chemicalSearchTerm]);

  const materialNameMap: { [key: string]: string } = {
    "Alleima® 3R12": "Alleima® 3R12 ('304L')",
    "Alleima® 3R60": "Alleima® 3R60 ('316L')",
    "Alleima® 3R64": "Alleima® 3R64 ('317L')",
    "Carbon steel": "Carbon Steel", // 대소문자 통일
    "Carbon Steel": "Carbon Steel", // 중복 제거를 위한 매핑
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
        // Carbon steel과 Carbon Steel을 통일
        const normalizedMaterial = item.material === "Carbon steel" ? "Carbon Steel" : item.material;
        materials.add(normalizedMaterial);
      }
    });
    const sortedBaseMaterials = sortMaterialsByPriority(Array.from(materials));
    const sortedFullMaterials = sortedBaseMaterials.map(m => materialNameMap[m] || m);
    // 중복 제거
    const uniqueMaterials = Array.from(new Set(sortedFullMaterials));
    return ["모든 재질", ...uniqueMaterials];
  }, [data.corrosion_data, selectedChemical]);

  // 검색어로 필터링된 재질 목록
  const filteredMaterials = useMemo(() => {
    if (!materialSearchTerm) return availableMaterials;
    
    return availableMaterials.filter(material => {
      // "모든 재질"은 항상 포함
      if (material === "모든 재질") return true;
      
      // 재질명에서 핵심 부분만 추출하여 검색
      // materialNameMap의 키(원본 재질명)와 값(표시용 재질명) 모두에서 검색
      const originalMaterial = Object.keys(materialNameMap).find(key => materialNameMap[key] === material) || material;
      
      // 원본 재질명과 표시용 재질명 모두에서 검색
      const searchTargets = [
        originalMaterial.toLowerCase(),
        material.toLowerCase(),
        // 괄호 안의 내용도 검색 대상에 포함 (예: '304L', '316L')
        ...material.match(/\('([^']+)'\)/g)?.map(match => match.replace(/[()'"]/g, '').toLowerCase()) || []
      ];
      
      const searchTerm = materialSearchTerm.toLowerCase();
      return searchTargets.some(target => target.includes(searchTerm));
    });
  }, [availableMaterials, materialSearchTerm]);

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
        // 유효한 rating 값인지 확인하는 함수
        const isValidRatingValue = (ratingValue: string): boolean => {
          if (!ratingValue || ratingValue.trim() === '') return false;
          const trimmed = ratingValue.trim();
          // 숫자 등급 (0, 1, 2) 또는 문자 등급 (p, c, s, ig, bp, nd 등)만 허용
          return /^[0-2]$/.test(trimmed) || 
                 /^[0-2][pcsig]+$/i.test(trimmed) || 
                 /^(BP|ND|p|c|s|ig|ps|cs|pcs|psig)$/i.test(trimmed);
        };

        // 유효한 농도 값인지 확인
        const hasValidConcentration = rating.concentrations.concentration_1?.value && 
                                    rating.concentrations.concentration_1.value.trim() !== '';

        // 유효한 온도 값인지 확인
        const hasValidTemperature = rating.temperature && rating.temperature.trim() !== '';

        if (isValidRatingValue(rating.rating) && 
            hasValidConcentration && 
            hasValidTemperature && 
            entry.material !== "Temp. °C" && 
            !entry.material.startsWith("Conc.")) { // 등급이 있고 온도/농도 행이 아닌 것만 포함
          if (isMultipleChemicals) {
            const conc1 = rating.concentrations.concentration_1?.value || '';
            const conc2 = rating.concentrations.concentration_2?.value || '';
            const conc3 = rating.concentrations.concentration_3?.value || '';
            const chem1 = rating.concentrations.concentration_1?.chemical || '';
            const chem2 = rating.concentrations.concentration_2?.chemical || '';
            const chem3 = rating.concentrations.concentration_3?.chemical || '';

            // 화학물질 공식을 사용하여 표시명 생성
            const chem1Display = entry.chemical_formulas ?
              Object.keys(entry.chemical_formulas).find(key => entry.chemical_formulas[key] === chem1) || chem1 : chem1;
            const chem2Display = entry.chemical_formulas ?
              Object.keys(entry.chemical_formulas).find(key => entry.chemical_formulas[key] === chem2) || chem2 : chem2;
            const chem3Display = entry.chemical_formulas ?
              Object.keys(entry.chemical_formulas).find(key => entry.chemical_formulas[key] === chem3) || chem3 : chem3;

            // 3개 화학물질 조합인지 확인
            if (conc3 && chem3) {
              // 3개 화학물질 조합
              const concentrations = [conc1, conc2, conc3];
              const chemicalNames = [chem1Display, chem2Display, chem3Display];
              
              // 재질명 정규화
              const normalizedMaterial = entry.material === "Carbon steel" ? "Carbon Steel" : entry.material;
              
              allResults.push({
                material: normalizedMaterial,
                concentration: `${chem1Display} ${conc1}% + ${chem2Display} ${conc2}% + ${chem3Display} ${conc3}%`,
                concentration1: `${conc1}%`,
                concentration2: `${conc2}%`,
                concentration3: `${conc3}%`,
                concentrations: concentrations,
                chemicalNames: chemicalNames,
                temperature: rating.temperature,
                rating: rating.rating,
                cell_class: rating.cell_class,
                isMultipleChemicals: true,
                chemicalCount: 3
              });
            } else {
              // 2개 화학물질 조합
              // 재질명 정규화
              const normalizedMaterial = entry.material === "Carbon steel" ? "Carbon Steel" : entry.material;
              
              allResults.push({
                material: normalizedMaterial,
                concentration: `${chem1Display} ${conc1}% + ${chem2Display} ${conc2}%`,
                concentration1: `${conc1}%`,
                concentration2: `${conc2}%`,
                temperature: rating.temperature,
                rating: rating.rating,
                cell_class: rating.cell_class,
                isMultipleChemicals: true,
                chemicalCount: 2
              });
            }
          } else {
            const conc1 = rating.concentrations.concentration_1?.value || '';
            // 재질명 정규화
            const normalizedMaterial = entry.material === "Carbon steel" ? "Carbon Steel" : entry.material;
            
            allResults.push({
              material: normalizedMaterial,
              concentration: `${conc1}%`,
              temperature: rating.temperature,
              rating: rating.rating,
              cell_class: rating.cell_class,
              isMultipleChemicals: false,
              chemicalCount: 1
            });
          }
        }
      });
    });

    // 재질 필터링 로직 추가
    let filteredByMaterial = allResults;
    if (selectedMaterial && selectedMaterial !== "모든 재질") {
      filteredByMaterial = allResults.filter(result => {
        // materialNameMap을 사용한 정확한 매칭
        const displayMaterial = materialNameMap[result.material] || result.material;
        
        // 역방향 매핑: 선택된 재질이 표시용 이름인 경우 원본 재질명 찾기
        const originalMaterial = Object.keys(materialNameMap).find(key => materialNameMap[key] === selectedMaterial);
        
        return displayMaterial === selectedMaterial || 
               result.material === selectedMaterial ||
               result.material === originalMaterial;
      });
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

  // 재질 선택에 따라 필터링된 호환성 결과
  const filteredCompatibilityResults = useMemo(() => {
    if (!selectedMaterial || selectedMaterial === "모든 재질") {
      return compatibilityResults;
    }

    // 선택된 재질에 해당하는 결과만 필터링
    return compatibilityResults.filter(result => {
      // 정확한 매칭을 위해 materialNameMap을 사용
      const displayMaterial = materialNameMap[result.material] || result.material;
      
      // 역방향 매핑: 선택된 재질이 표시용 이름인 경우 원본 재질명 찾기
      const originalMaterial = Object.keys(materialNameMap).find(key => materialNameMap[key] === selectedMaterial);
      
      return displayMaterial === selectedMaterial || 
             result.material === selectedMaterial ||
             result.material === originalMaterial;
    });
  }, [compatibilityResults, selectedMaterial]);

  // 호환성 결과가 변경될 때마다 동적 폭 계산
  useEffect(() => {
    if (filteredCompatibilityResults.length > 0) {
      calculateOptimalWidths(filteredCompatibilityResults);
    }
  }, [filteredCompatibilityResults]);

  // 특정 화학물질-재질 조합의 호환성
  const specificCompatibility = useMemo(() => {
    if (!selectedChemical || !selectedMaterial) return null;

    const entry = data.corrosion_data.find(
      e => e.chemical === selectedChemical && e.material === selectedMaterial
    );

    return entry || null;
  }, [selectedChemical, selectedMaterial, data.corrosion_data]);



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
          return '부식 속도 0.1mm/년 미만.';
        case '1':
          return '부식 속도 0.1–1.0mm/년.';
        case '2':
          return '부식 속도 1.0mm/년 초과.';
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

  // 등급별 아이콘 반환
  const getRatingIcon = (rating: string) => {
    const ratingInfo = getRatingInfo(rating);
    const IconComponent = ratingInfo.icon;

    return (
      <IconComponent
        className={`w-4 h-4 ${
          rating === '0' ? 'text-green-600' :
          rating === '1' ? 'text-yellow-600' :
          rating === '2' ? 'text-red-600' :
          'text-gray-600'
        }`}
      />
    );
  };

  const getRatingBadge = (rating: string) => {
    const ratingInfo = getRatingInfo(rating);
    const IconComponent = ratingInfo.icon;

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ratingInfo.color === 'bg-white border border-gray-300' ? 'text-gray-700' : 'text-white'} ${ratingInfo.color}`}>
        <IconComponent className="w-2 h-2 mr-1" />
        {rating}
      </span>
    );
  };



  return (
    <div className="space-y-6">


      {/* 검색 섹션 */}
      <div className="mt-6 rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6 pb-1">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
            <h2 className="text-2xl font-semibold leading-none tracking-tight">Material Corrosion Compatibility</h2>
      </div>
       <div className="text-xs text-gray-500 py-2 ml-4 flex items-center">
         - 부식 데이터는 실제 수행한 일반 부식 실험실 테스트 결과를 기반으로 합니다. (출처 : Alleima (Sandvik))
       </div>
        </div>
        <div className="p-6 pt-0">

        <div className="flex flex-col md:flex-row md:items-end gap-2 md:gap-3 mt-2 mb-2">
          {/* 화학물질 선택 */}
          <div className="w-full md:w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2 sr-only">
              화학물질 선택
            </label>
            <Select value={selectedChemical} onValueChange={setSelectedChemical} onOpenChange={setIsChemicalSelectOpen}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="화학물질을 선택하세요" />
              </SelectTrigger>
              <SelectContent className="min-w-max">
                <div className="p-2 border-b">
                  <Input
                    ref={chemicalSearchRef}
                    placeholder="화학물질 검색..."
                    value={chemicalSearchTerm}
                    onChange={(e) => {
                      e.stopPropagation();
                      setChemicalSearchTerm(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                    }}
                    onFocus={(e) => {
                      e.stopPropagation();
                    }}
                    className="h-8"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {filteredChemicals.map((chemical) => (
                    <SelectItem key={chemical} value={chemical}>
                      {chemical}
                    </SelectItem>
                  ))}
                </div>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2 sr-only">
              재질 선택
            </label>
            <Select value={selectedMaterial} onValueChange={setSelectedMaterial} onOpenChange={setIsMaterialSelectOpen}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="재질을 선택하세요" />
              </SelectTrigger>
              <SelectContent className="min-w-max">
                <div className="p-2 border-b">
                  <Input
                    ref={materialSearchRef}
                    placeholder="재질 검색..."
                    value={materialSearchTerm}
                    onChange={(e) => {
                      e.stopPropagation();
                      setMaterialSearchTerm(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                    }}
                    onFocus={(e) => {
                      e.stopPropagation();
                    }}
                    className="h-8"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {filteredMaterials.map((material) => (
                    <SelectItem key={material} value={material}>
                      {material}
                    </SelectItem>
                  ))}
                </div>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2 sr-only">
              모든 등급
            </label>
            <Select value={selectedRating} onValueChange={setSelectedRating}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="모든 등급" />
              </SelectTrigger>
              <SelectContent className="min-w-max">
                <SelectItem value="all">모든 등급</SelectItem>
                {availableRatings.map((rating) => (
                  <SelectItem key={rating} value={rating}>
                    {rating}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


        </div>
        </div>
      </div>

      {/* 특정 재질 선택시 결과 */}
      {/* 이 섹션은 이제 필요 없으므로 주석 처리하거나 제거할 수 있습니다. */}
      {/* {selectedChemical && selectedMaterial && specificCompatibility && (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-2 md:p-6">
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
      {selectedChemical && filteredCompatibilityResults.length > 0 && (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-2 md:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {getChemicalTitleWithFormulas(selectedChemical)} 호환성 결과
          </h3>

          {/* 모바일에서는 카드 형태로 표시 */}
          <div className="block sm:hidden space-y-4">
            {filteredCompatibilityResults.map((result, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm max-w-full">
                <div className="space-y-2">
                  <div className="block">
                    <span className="font-semibold text-sm text-gray-700 min-w-fit block mb-1">재질명</span>
                    <span className="text-sm font-medium text-right break-words max-w-full block">{result.material}</span>
                  </div>

                  {selectedChemical && selectedChemical.includes('+') ? (
                    (() => {
                      const chemicalParts = selectedChemical.split('+').map(part => part.trim());
                      const chemicalCount = chemicalParts.length;

                      if (chemicalCount >= 3) {
                        // 3개 이상 화학물질 조합 - 실제 데이터 사용
                        if (result.concentrations && result.chemicalNames) {
                          return result.chemicalNames.map((chemName, idx) => (
                            <div key={idx} className="block">
                              <span className="font-semibold text-sm text-gray-700 min-w-fit block mb-1">{chemName} 농도</span>
                              <span className="text-sm text-right break-words max-w-full block">{result.concentrations?.[idx] || 'N/A'}</span>
                            </div>
                          ));
                        }
                      }

                      return chemicalParts.map((chemName, idx) => (
                        <div key={idx} className="flex flex-wrap justify-between items-center">
                          <span className="font-semibold text-sm text-gray-700 min-w-[80px]">{chemName} 농도</span>
                          <span className="text-sm text-right break-words max-w-[60%]">
                            {idx === 0 ? result.concentration1 :
                             idx === 1 ? result.concentration2 :
                             idx === 2 ? result.concentration3 : 'N/A'}
                          </span>
                        </div>
                      ));
                    })()
                  ) : (
                    <div className="flex flex-wrap justify-between items-center">
                      <span className="font-semibold text-sm text-gray-700 min-w-[80px]">농도</span>
                      <span className="text-sm text-right break-words max-w-[60%]">{result.concentration}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap justify-between items-center">
                    <span className="font-semibold text-sm text-gray-700 min-w-[80px]">온도 (°C)</span>
                    <span className="text-sm text-right break-words max-w-[60%]">{result.temperature}</span>
                  </div>

                  <div className="flex flex-wrap justify-between items-center">
                    <span className="font-semibold text-sm text-gray-700 min-w-[80px]">호환성 등급</span>
                    <span className="text-sm text-right break-words max-w-[60%]">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRatingBadge(result.rating).props.className}`}>
                        {getRatingIcon(result.rating)}
                        <span className="ml-1">{result.rating}</span>
                      </span>
                    </span>
                  </div>

                  <div className="pt-2 border-t">
                    <span className="font-semibold text-sm text-gray-700 block mb-1">비고</span>
                    <div className="text-sm text-gray-600 break-words" dangerouslySetInnerHTML={{ __html: getDetailedRatingDescription(result.rating) || 'N/A' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 데스크톱에서는 테이블 형태로 표시 */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-black">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-center text-sm font-semibold text-black uppercase tracking-wider">
                    재질명
                  </th>
                  {selectedChemical && selectedChemical.includes('+') ? (
                    (() => {
                      const chemicalParts = selectedChemical.split('+').map(part => part.trim());
                      const chemicalCount = chemicalParts.length;

                      // 3개 이상의 화학물질인 경우 실제 데이터에서 화학물질 이름 가져오기
                      if (chemicalCount >= 3) {
                        // 첫 번째 결과에서 화학물질 이름 가져오기
                        const firstResult = compatibilityResults[0];
                        if (firstResult && firstResult.chemicalNames) {
                          return firstResult.chemicalNames.map((chemName, idx) => (
                            <th key={idx} className="px-4 py-2 text-center text-sm font-semibold text-black uppercase tracking-wider whitespace-nowrap">
                              {chemName} 농도
                            </th>
                          ));
                        }
                      }

                      // 2개 화학물질인 경우 (기존 로직)
                      return chemicalParts.map((chemName, idx) => (
                        <th key={idx} className="px-4 py-2 text-center text-sm font-semibold text-black uppercase tracking-wider whitespace-nowrap">
                          {chemName} 농도
                        </th>
                      ));
                    })()
                  ) : (
                    <th className="px-4 py-2 text-center text-sm font-semibold text-black uppercase tracking-wider whitespace-nowrap">
                      농도
                    </th>
                  )}
                  <th className="px-4 py-2 text-center text-sm font-semibold text-black uppercase tracking-wider">
                    온도 (°C)
                  </th>
                  <th className="px-4 py-2 text-center text-sm font-semibold text-black uppercase tracking-wider">
                    호환성 등급
                  </th>
                  <th className="px-4 py-2 text-center text-sm font-semibold text-black uppercase tracking-wider">
                    비고
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-black">
                {filteredCompatibilityResults.map((result, index) => {
                  let rowSpan = 1;
                  for (let i = index + 1; i < filteredCompatibilityResults.length; i++) {
                    if (filteredCompatibilityResults[i].material === result.material) {
                      rowSpan++;
                    } else {
                      break;
                    }
                  }

                  if (index > 0 && filteredCompatibilityResults[index - 1].material === result.material) {
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        {result.isMultipleChemicals ? (
                          (() => {
                            if (result.chemicalCount && result.chemicalCount >= 3 && result.concentrations) {
                              // 3개 이상의 화학물질인 경우 실제 데이터 사용
                              return result.concentrations.map((conc, idx) => (
                                <td key={idx} className="px-3 py-1 text-sm text-black whitespace-nowrap text-center">
                                  {conc}
                                </td>
                              ));
                            } else {
                              // 2개 화학물질인 경우 (기존 로직)
                              return (
                                <>
                                  <td className="px-3 py-1 text-sm text-black whitespace-nowrap text-center">
                                    {result.concentration1}
                                  </td>
                                  <td className="px-3 py-1 text-sm text-black whitespace-nowrap text-center">
                                    {result.concentration2}
                                  </td>
                                </>
                              );
                            }
                          })()
                        ) : (
                          <td className="px-3 py-1 text-sm text-black whitespace-nowrap text-center">
                            {result.concentration}
                          </td>
                        )}
                        <td className="px-3 py-1 text-sm text-black text-center">
                          {result.temperature}
                        </td>
                        <td className="px-3 py-1 text-sm text-black text-center">
                          {getRatingBadge(result.rating)}
                        </td>
                        <td className="px-3 py-1 text-sm text-black text-center">
                          {getDetailedRatingDescription(result.rating) ? (
                            <div className="max-w-xs break-words" dangerouslySetInnerHTML={{ __html: getDetailedRatingDescription(result.rating) }} />
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
                        className="px-3 py-1 text-sm font-medium text-gray-900 text-center align-middle"
                      >
                          {result.material === "Alleima® 3R12" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center justify-center">
                                Alleima® 3R12 (&apos;304L&apos;)
                                <Info className="w-4 h-4 ml-1 text-gray-400 cursor-pointer" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              sideOffset={5}
                              className="relative bg-white text-black p-2 border border-gray-300 rounded-md shadow-lg"
                            >
                              <p>ASTM: TP304/TP304L</p>
                              <p>UNS: S30400/S30403</p>
                              <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white"></div>
                            </TooltipContent>
                          </Tooltip>
                        ) : result.material === "Alleima® 2RK65 ('904L')" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center justify-center">
                                Alleima® 2RK65 (&apos;904L&apos;)
                                <Info className="w-4 h-4 ml-1 text-gray-400 cursor-pointer" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              sideOffset={5}
                              className="relative bg-white text-black p-2 border border-gray-300 rounded-md shadow-lg"
                            >
                              <p>ASTM: 904L</p>
                              <p>UNS: N08904</p>
                              <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white"></div>
                            </TooltipContent>
                          </Tooltip>
                        ) : result.material === "Alleima® 3R64 ('317L')" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center justify-center">
                                Alleima® 3R64 (&apos;317L&apos;)
                                <Info className="w-4 h-4 ml-1 text-gray-400 cursor-pointer" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              sideOffset={5}
                              className="relative bg-white text-black p-2 border border-gray-300 rounded-md shadow-lg"
                            >
                              <p>ASTM: TP317L</p>
                              <p>UNS: S31703</p>
                              <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white"></div>
                            </TooltipContent>
                          </Tooltip>
                        ) : result.material === "Alleima® 3R60" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center justify-center">
                                Alleima® 3R60 (&apos;316L&apos;)
                                <Info className="w-4 h-4 ml-1 text-gray-400 cursor-pointer" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              sideOffset={5}
                              className="relative bg-white text-black p-2 border border-gray-300 rounded-md shadow-lg"
                            >
                              <p>ASTM: TP316/TP316L</p>
                              <p>UNS: S31600/S31603</p>
                              <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white"></div>
                            </TooltipContent>
                          </Tooltip>
                        ) : result.material === "SAF™ 2205" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center justify-center">
                                SAF™ 2205
                                <Info className="w-4 h-4 ml-1 text-gray-400 cursor-pointer" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              sideOffset={5}
                              className="relative bg-white text-black p-2 border border-gray-300 rounded-md shadow-lg"
                            >
                              <p>UNS: S32205/S31803</p>
                              <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white"></div>
                            </TooltipContent>
                          </Tooltip>
                         ) : result.material === "SAF™ 2304" ? (
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <span className="flex items-center justify-center">
                                 SAF™ 2304
                                 <Info className="w-4 h-4 ml-1 text-gray-400 cursor-pointer" />
                               </span>
                             </TooltipTrigger>
                             <TooltipContent
                               side="top"
                               sideOffset={5}
                               className="relative bg-white text-black p-2 border border-gray-300 rounded-md shadow-lg"
                             >
                               <p>UNS: S32304</p>
                               <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white"></div>
                             </TooltipContent>
                           </Tooltip>
                          ) : result.material === "SAF™ 2507" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center justify-center">
                                  SAF™ 2507
                                  <Info className="w-4 h-4 ml-1 text-gray-400 cursor-pointer" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                sideOffset={5}
                                className="relative bg-white text-black p-2 border border-gray-300 rounded-md shadow-lg"
                              >
                                <p>UNS: S32750, ASTM A789, A790</p>
                                <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white"></div>
                             </TooltipContent>
                           </Tooltip>
                          ) : result.material === "SAF™ 2707 HD" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center justify-center">
                                  SAF™ 2707 HD
                                  <Info className="w-4 h-4 ml-1 text-gray-400 cursor-pointer" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                sideOffset={5}
                                className="relative bg-white text-black p-2 border border-gray-300 rounded-md shadow-lg"
                              >
                                <p>UNS: S32707, ASTM A789, A790</p>
                                <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white"></div>
                             </TooltipContent>
                           </Tooltip>
                          ) : result.material === "SAF™ 2906" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center justify-center">
                                  SAF™ 2906
                                  <Info className="w-4 h-4 ml-1 text-gray-400 cursor-pointer" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                sideOffset={5}
                                className="relative bg-white text-black p-2 border border-gray-300 rounded-md shadow-lg"
                              >
                                <p>UNS: S32906, ASTM A789, A790</p>
                                <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white"></div>
                             </TooltipContent>
                           </Tooltip>
                          ) : result.material === "SAF™ 3207 HD" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center justify-center">
                                  SAF™ 3207 HD
                                  <Info className="w-4 h-4 ml-1 text-gray-400 cursor-pointer" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                sideOffset={5}
                                className="relative bg-white text-black p-2 border border-gray-300 rounded-md shadow-lg"
                              >
                                <p>UNS: S33207, ASTM A789, A790</p>
                                <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white"></div>
                             </TooltipContent>
                           </Tooltip>
                          ) : result.material === "Sanicro® 28" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center justify-center">
                                  Sanicro® 28
                                  <Info className="w-4 h-4 ml-1 text-gray-400 cursor-pointer" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                sideOffset={5}
                                className="relative bg-white text-black p-2 border border-gray-300 rounded-md shadow-lg"
                              >
                                <p>UNS: N08028, ASTM B 668</p>
                                <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white"></div>
                             </TooltipContent>
                           </Tooltip>
                          ) : result.material === "254 SMO" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center justify-center">
                                  254 SMO
                                  <Info className="w-4 h-4 ml-1 text-gray-400 cursor-pointer" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                sideOffset={5}
                                className="relative bg-white text-black p-2 border border-gray-300 rounded-md shadow-lg"
                              >
                                <p>UNS: S31254</p>
                                <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white"></div>
                              </TooltipContent>
                            </Tooltip>
                           ) : result.material}
                      </td>
                      {result.isMultipleChemicals ? (
                        (() => {
                          if (result.chemicalCount && result.chemicalCount >= 3 && result.concentrations) {
                            // 3개 이상의 화학물질인 경우 실제 데이터 사용
                            return result.concentrations.map((conc, idx) => (
                              <td key={idx} className="min-w-[80px] px-2 py-1 text-sm text-black whitespace-nowrap text-center">
                                {conc}
                              </td>
                            ));
                          } else {
                            // 2개 화학물질인 경우 (기존 로직)
                            return (
                              <>
                                <td className="min-w-[80px] px-2 py-1 text-sm text-black whitespace-nowrap text-center">
                                  {result.concentration1}
                                </td>
                                <td className="min-w-[80px] px-2 py-1 text-sm text-black whitespace-nowrap text-center">
                                  {result.concentration2}
                                </td>
                              </>
                            );
                          }
                        })()
                      ) : (
                        <td className="min-w-[80px] px-2 py-1 text-sm text-black whitespace-nowrap text-center">
                          {result.concentration}
                        </td>
                      )}
                      <td className="min-w-[60px] px-2 py-1 text-sm text-black text-center">
                        {result.temperature}
                      </td>
                      <td className="min-w-[60px] px-2 py-1 text-sm text-black text-center">
                        {getRatingBadge(result.rating)}
                      </td>
                      <td className="min-w-[100px] max-w-xs px-2 py-1 text-sm text-black break-words text-center">
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



      {/* 호환성 등급 설명 */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">호환성 등급 설명</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-3">
          {Object.entries(data.symbol_clarification).map(([symbol, description]) => (
            <div key={symbol} className="flex items-center space-x-2">
              {getRatingBadge(symbol)}
              <p className="text-xs text-gray-700">{getKoreanRatingDescription(symbol)}</p>
            </div>
          ))}
        </div>


      </div>
    </div>
  );
};

export default CorrosionCompatibility;