'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Download, RotateCcw, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { translateDescription, getKoreanSummary } from '../../utils/translateDescription';

import CorrosionCompatibility from '../corrosion/CorrosionCompatibility';

interface MakeItFromMaterial {
  names: string[];
  properties: Array<{
    name: string;
    scalars: string;
    units?: string;
  }>;
  composition?: Array<{
    element: string;
    actualWeightPercent: string;
  }>;
  category: string;
}

interface MaterialItem {
  name: string;
  selectable: boolean;
  makeitfrom_names: Array<{
    name: string;
    similarity_score: number;
  }>;
}

interface SelectedMaterial {
  id: string; // Add id field
  name: string;
  properties: { [key: string]: { value: string; unit?: string } };
  composition: { [key: string]: string };
  basePrice?: { value: string; unit?: string };
  active: boolean;
}

// 한국어 물성명 매핑
const propertyKoreanNames: { [key: string]: { korean: string; description: string } } = {
  'Density': { korean: '밀도', description: '재료의 단위 부피당 질량' },
  'Yield Strength': { korean: '항복강도', description: '재료가 소성변형을 시작하는 응력' },
  'Ultimate Strength': { korean: '인장강도', description: '재료가 견딜 수 있는 최대 인장응력' },
  'Elongation': { korean: '연신율', description: '파단 시까지의 변형률' },
  'Modulus of Elasticity': { korean: '탄성계수', description: '재료의 탄성변형에 대한 저항' },
  "Poisson's Ratio": { korean: '푸아송비', description: '축방향 변형률 대비 횡방향 변형률의 비' },
  'Maximum Service Temperature': { korean: '최대사용온도', description: '재료가 안전하게 사용할 수 있는 최대 온도' },
  'Coefficient of Thermal Expansion': { korean: '열팽창계수', description: '온도 변화에 따른 치수 변화율' },
  'Elastic (Young\'s, Tensile) Modulus': { korean: '탄성계수', description: '재료의 탄성변형에 대한 저항' },
  'Tensile Strength: Ultimate (UTS)': { korean: '인장강도', description: '재료가 견딜 수 있는 최대 인장응력' },
  'Tensile Strength: Yield (Proof)': { korean: '항복강도', description: '재료가 소성변형을 시작하는 응력' },
  'Brinell Hardness': { korean: '브리넬 경도', description: '재료의 경도를 측정하는 방법 중 하나' },
  'Bismuth (Bi)': { korean: '비스무트', description: '화학 원소 Bi' },
  'Elongation at Break': { korean: '연신율', description: '파단 시까지의 변형률' },
  'Electrical Conductivity': { korean: '전기전도도', description: '전기를 전도하는 능력' },
  'Electrical Resistivity Order of Magnitude': { korean: '전기저항률', description: '전기 전도에 대한 저항' },
  'Thermal Conductivity': { korean: '열전도도', description: '열을 전도하는 능력' },
  'Thermal Expansion': { korean: '열팽창계수', description: '온도 변화에 따른 치수 변화율' },
  'Specific Heat Capacity': { korean: '비열', description: '단위 질량당 온도를 1도 올리는데 필요한 열량' },
  'Melting Onset (Solidus)': { korean: '융점', description: '고체에서 액체로 변하기 시작하는 온도' },
  'Shear Modulus': { korean: '전단탄성계수', description: '전단변형에 대한 저항' },
  'Strength to Weight Ratio': { korean: '비강도', description: '강도 대비 무게의 비율' },
  'Modulus of Resilience (Unit Resilience)': { korean: '복원탄성계수', description: '탄성한계까지 저장할 수 있는 에너지' },
  'Unit Rupture Work (Ultimate Resilience)': { korean: '파괴인성', description: '파괴까지 흡수할 수 있는 에너지' },
  'Thermal Diffusivity': { korean: '열확산율', description: '열이 확산되는 속도' },
  'Calomel Potential': { korean: '칼로멜 전위', description: '전기화학적 부식 전위' },
  'Base Metal Price': { korean: '기본 금속 가격', description: '재료의 상대적 가격 지수' },
  // 누락된 물성들 추가
  'Dielectric Constant (Relative Permittivity) At 1 Hz': { korean: '유전상수 (1 Hz)', description: '1 Hz에서의 상대 유전율' },
  'Dielectric Constant (Relative Permittivity) At 1 MHz': { korean: '유전상수 (1 MHz)', description: '1 MHz에서의 상대 유전율' },
  'Dielectric Strength (Breakdown Potential)': { korean: '절연파괴강도', description: '절연체가 파괴되는 전계강도' },
  'Flexural Modulus': { korean: '굽힘탄성계수', description: '굽힘 변형에 대한 저항' },
  'Compressive (Crushing) Strength': { korean: '압축강도', description: '재료가 압축 하중을 견딜 수 있는 능력' },
  'Flexural Strength': { korean: '굴곡강도', description: '재료가 굽힘 하중을 견딜 수 있는 능력' },
  'Glass Transition Temperature': { korean: '유리 전이 온도', description: '비정질 고체가 유리 상태에서 고무 상태로 변하는 온도' },
  'Heat Deflection Temperature At 1.82 MPa (264 psi)': { korean: '열변형온도 (1.82 MPa)', description: '1.82 MPa 하중에서의 열변형 온도' },
  'Heat Deflection Temperature At 455 kPa (66 psi)': { korean: '열변형온도 (455 kPa)', description: '455 kPa 하중에서의 열변형 온도' },
  'Impact Strength: Notched Izod': { korean: '아이조드 충격강도', description: '노치 시편의 충격 저항' },
  'Limiting Oxygen Index (LOI)': { korean: '한계산소지수', description: '연소를 유지하는데 필요한 최소 산소농도' },
  'Water Absorption After 24 Hours': { korean: '24시간 흡수율', description: '24시간 후 물 흡수율' },
  'Water Absorption At Saturation': { korean: '포화 수분 흡수율', description: '포화 상태에서의 물 흡수율' },
  // 사용자가 지적한 누락된 물성들 추가
  'Fatigue Strength': { korean: '피로강도', description: '반복 하중에 대한 저항 강도' },
  'Reduction in Area': { korean: '단면수축률', description: '인장 시험에서 파단 후 단면적 감소율' },
  'Rockwell C Hardness': { korean: '로크웰 C 경도', description: '로크웰 C 스케일로 측정한 경도' },
  'Latent Heat of Fusion': { korean: '융해잠열', description: '고체에서 액체로 상변화 시 필요한 열량' },
  'Melting Completion (Liquidus)': { korean: '완전용융온도', description: '고체가 완전히 액체로 변하는 온도' },
  'Electrical Conductivity: Equal Volume': { korean: '전기전도도 (동일부피)', description: '동일 부피 기준 전기 전도도' },
  'Electrical Conductivity: Equal Weight (Specific)': { korean: '전기전도도 (동일중량)', description: '동일 중량 기준 전기 전도도' },
  'Embodied Carbon': { korean: '내재탄소', description: '재료 생산 과정에서 배출되는 탄소량' },
  'Embodied Energy': { korean: '내재에너지', description: '재료 생산 과정에서 소비되는 에너지량' },
  'Embodied Water': { korean: '내재수자원', description: '재료 생산 과정에서 사용되는 물의 양' },
  'Maximum Temperature: Mechanical': { korean: '최대사용온도 (기계적)', description: '기계적 성질을 유지할 수 있는 최대 온도' },
  'Shear Strength': { korean: '전단강도', description: '재료가 전단 하중에 견딜 수 있는 능력' },
  'Maximum Temperature: Decomposition': { korean: '최대 분해 온도', description: '재료가 분해되기 시작하는 최대 온도' },
  'Vicat Softening Temperature': { korean: '비카트 연화 온도', description: '열가소성 플라스틱의 연화점' },
  'Curie Temperature': { korean: '큐리 온도', description: '강자성체가 상자성체로 변하는 온도' }
};

// 원소의 한국어 이름 매핑
const elementKoreanNames: { [key: string]: string } = {
  'C': '탄소',
  'Cr': '크롬',
  'Ni': '니켈',
  'Mo': '몰리브덴',
  'Mn': '망간',
  'Si': '규소',
  'Fe': '철',
  'V': '바나듐',
  'Ti': '티타늄',
  'Nb': '니오븀',
  'Al': '알루미늄',
  'Co': '코발트',
  'Cu': '구리',
  'W': '텅스텐',
  'P': '인',
  'S': '황',
  'N': '질소',
  'O': '산소',
  'B': '붕소',
  'Ca': '칼슘',
  'Mg': '마그네슘',
  'Zn': '아연',
  'Pb': '납',
  'Bi': '비스무트',
  'Sn': '주석',
  'Zr': '지르코늄',
  'Ta': '탄탈럼',
  'Hf': '하프늄',
  'Re': '레늄',
  'Ru': '루테늄',
  'Rh': '로듐',
  'Pd': '팔라듐',
  'Ag': '은',
  'Cd': '카드뮴',
  'In': '인듐',
  'Sb': '안티몬',
  'Te': '텔루륨',
  'I': '요오드',
  'Cs': '세슘',
  'Ba': '바륨',
  'La': '란타넘',
  'Ce': '세륨',
  'Pr': '프라세오디뮴',
  'Nd': '네오디뮴',
  'Pm': '프로메튬',
  'Sm': '사마륨',
  'Eu': '유로퓸',
  'Gd': '가돌리늄',
  'Tb': '테르븀',
  'Dy': '디스프로슘',
  'Ho': '홀뮴',
  'Er': '에르븀',
  'Tm': '툴륨',
  'Yb': '이테르븀',
  'Lu': '루테튬',
  'Y': '이트륨',
  'Sc': '스칸듐',
  'Be': '베릴륨',
  'Li': '리튬',
  'Na': '나트륨',
  'K': '칼륨',
  'Rb': '루비듐',
  'Fr': '프랑슘',
  'Ra': '라듐',
  'Ac': '악틀늄',
  'Th': '토륨',
  'Pa': '프로트악틀늄',
  'U': '우라늄',
  'Np': '넵투늄',
  'Pu': '플루토늄',
  'Am': '아메리슘',
  'Cm': '큐륨',
  'Bk': '버클륨',
  'Cf': '캘리포늄',
  'Es': '아인슈타이늄',
  'Fm': '페르뮴',
  'Md': '멘델레븀',
  'No': '노벨륨',
  'Lr': '로렌슘',
  'res.': '잔량'
};

// 단위 표시 함수
const formatUnit = (unit?: string): string => {
  if (!unit) return '';
  
  // LaTeX 수학 기호를 HTML로 변환
  return unit
    .replace(/\$\^\{([^}]+)\}\$/g, '<sup>$1</sup>')
    .replace(/\$\_\{([^}]+)\}\$/g, '<sub>$1</sub>')
    .replace(/\$\^\{\\circ\}\$/g, '°')
    .replace(/\$\^\{([^}]+)\}\$/g, '<sup>$1</sup>')
    .replace(/\$\\mu\$/g, 'μ')
    .replace(/\$\\Omega\$/g, 'Ω')
    .replace(/\$\^\{x\}\$/g, '<sup>x</sup>')
    .replace(/\$\^\{\\circ\}\$/g, '°')
    .replace(/\$\^\{3\}\$/g, '³')
    .replace(/\$\^\{2\}\$/g, '²')
    .replace(/\$\\#circ\$/g, '°')
    .replace(/\$/g, '');
};

// 범위 표시를 'to' 대신 '~'로 변경하는 함수
const formatRangeValue = (value: string): string => {
  if (!value) return value;
  
  // 숫자 to 숫자 패턴을 숫자 ~ 숫자로 변경
  return value.replace(/(\d+\.?\d*)\s+to\s+(\d+\.?\d*)/g, '$1 ~ $2');
};

// 물성 순서 정의 (기계적 → 열적 → 전기적)
const propertyOrder: { [key: string]: number } = {
  // 1) 기계적 물성 (Mechanical Properties)
  'Density': 1,
  'Strength to Weight Ratio': 2,
  'Tensile Strength: Yield (Proof)': 3,
  'Tensile Strength: Ultimate (UTS)': 4,
  'Yield Strength': 5,
  'Ultimate Strength': 6,
  'Brinell Hardness': 7,
  'Rockwell C Hardness': 8,
  'Elongation at Break': 9,
  'Elongation': 10,
  'Reduction in Area': 11,
  'Elastic (Young\'s, Tensile) Modulus': 12,
  'Modulus of Elasticity': 13,
  'Shear Modulus': 14,
  'Poisson\'s Ratio': 15,
  'Fatigue Strength': 16,
  'Unit Rupture Work (Ultimate Resilience)': 17,
  'Modulus of Resilience (Unit Resilience)': 18,
  'Impact Strength: Notched Izod': 19,
  'Compressive (Crushing) Strength': 20,
  'Flexural Strength': 21,
  'Flexural Modulus': 22,

  // 2) 열적 물성 (Thermal Properties)
  'Thermal Conductivity': 23,
  'Thermal Diffusivity': 24,
  'Coefficient of Thermal Expansion': 25,
  'Thermal Expansion': 26,
  'Specific Heat Capacity': 27,
  'Melting Onset (Solidus)': 28,
  'Melting Completion (Liquidus)': 29,
  'Latent Heat of Fusion': 30,
  'Maximum Service Temperature': 31,
  'Maximum Temperature: Mechanical': 32,
  'Glass Transition Temperature': 33,
  'Heat Deflection Temperature At 1.82 MPa (264 psi)': 34,
  'Heat Deflection Temperature At 455 kPa (66 psi)': 35,

  // 3) 전기적 물성 (Electrical Properties)
  'Electrical Conductivity': 36,
  'Electrical Conductivity: Equal Volume': 37,
  'Electrical Conductivity: Equal Weight (Specific)': 38,
  'Electrical Resistivity Order of Magnitude': 39,
  'Dielectric Constant (Relative Permittivity) At 1 Hz': 40,
  'Dielectric Constant (Relative Permittivity) At 1 MHz': 41,
  'Dielectric Strength (Breakdown Potential)': 42,

  // 4) 기타 물성
  'Calomel Potential': 43,
  'Embodied Carbon': 44,
  'Embodied Energy': 45,
  'Embodied Water': 46,
  'Limiting Oxygen Index (LOI)': 47,
  'Water Absorption After 24 Hours': 48,
  'Water Absorption At Saturation': 49
};

// 물성 정렬 함수
const sortPropertiesByOrder = (properties: string[]): string[] => {
  return properties.sort((a, b) => {
    const orderA = propertyOrder[a] || 999; // 정의되지 않은 물성은 맨 뒤로
    const orderB = propertyOrder[b] || 999;
    return orderA - orderB;
  });
};

// 성분조성 순서 정의 (C, Cr, Ni, Mo, Mn, Si, Fe, V, Ti, Nb, Al, Cu, Co, W, P, S, N, O)
const elementOrder: { [key: string]: number } = {
  'C': 1,
  'Cr': 2,
  'Ni': 3,
  'Mo': 4,
  'Mn': 5,
  'Si': 6,
  'Fe': 7,
  'V': 8,
  'Ti': 9,
  'Nb': 10,
  'Al': 11,
  'Cu': 12,
  'Co': 13,
  'W': 14,
  'P': 15,
  'S': 16,
  'N': 17,
  'O': 18,
  'res.': 1000
};

// 성분조성 정렬 함수
const sortElementsByOrder = (elements: string[]): string[] => {
  return elements.sort((a, b) => {
    const orderA = elementOrder[a] || 999; // 정의되지 않은 원소는 맨 뒤로
    const orderB = elementOrder[b] || 999;
    return orderA - orderB;
  });
};

// 새로운 데이터 구조에 맞는 인터페이스
interface NewMaterialProperty {
  name: string;
  scalars: string;
  units?: string;
}

interface NewMaterialData {
  name: string;
  url: string;
  category: string;
  description: string;
  properties: NewMaterialProperty[];
}

// 4-level 구조: Major > Middle > Minor > Materials[]
// 3-level 구조: Major > Middle > materials[]
interface CategoryStructure {
  [majorCategory: string]: {
    [middleCategory: string]: {
      [minorCategory: string]: NewMaterialData[] | { materials: NewMaterialData[] };
    } | { materials: NewMaterialData[] };
  };
}

export default function MaterialComparisonPage({ initialData }: { initialData: CategoryStructure }) {
  const [allData, setAllData] = useState<CategoryStructure>(initialData);
  const [selectedMajor, setSelectedMajor] = useState<string>('');
  const [selectedMiddle, setSelectedMiddle] = useState<string>('');
  const [selectedSub, setSelectedSub] = useState<string>('');
  const [selectedDetail, setSelectedDetail] = useState<string>('');
  const [selectedMaterials, setSelectedMaterials] = useState<SelectedMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // 검색 기능을 위한 상태
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  useEffect(() => {
    setSelectedMaterials([]); // 페이지 로드 시 selectedMaterials 초기화
  }, []); // 빈 의존성 배열을 사용하여 컴포넌트 마운트 시 한 번만 실행

  // 카테고리별 옵션 추출
  const majorCategories = Object.keys(allData);
  const middleCategories = selectedMajor ? Object.keys(allData[selectedMajor] || {}) : [];
  
  // 소분류 추출 (3-level vs 4-level 구조 처리)
  const subCategories = selectedMajor && selectedMiddle ? (() => {
    const middleData = allData[selectedMajor]?.[selectedMiddle];
    if (!middleData) return [];
    
    // 3-level 구조인지 확인 (materials 키가 있는지)
    if ('materials' in middleData) {
      return []; // 3-level 구조에서는 소분류가 없음
    }
    
    // 4-level 구조
    return Object.keys(middleData);
  })() : [];
  
  // 재료 목록 추출
  const availableMaterials: NewMaterialData[] = (() => {
    if (!selectedMajor || !selectedMiddle) return [];
    
    const middleData = allData[selectedMajor]?.[selectedMiddle];
    if (!middleData) return [];
    
    // 3-level 구조 - materials 속성이 있는 경우
    if ('materials' in middleData && Array.isArray(middleData.materials)) {
      return middleData.materials;
    }
    
    // 4-level 구조
    if (selectedSub) {
      const subData = (middleData as any)[selectedSub];
      if (Array.isArray(subData)) {
        return subData;
      }
      if (subData && typeof subData === 'object' && 'materials' in subData && Array.isArray(subData.materials)) {
        return subData.materials;
      }
    }
    
    return [];
  })();

  // 전체 재료 목록을 검색하기 위한 함수
  const getAllMaterials = useMemo((): NewMaterialData[] => {
    const materials: NewMaterialData[] = [];
    
    Object.entries(allData).forEach(([majorKey, majorValue]) => {
      Object.entries(majorValue).forEach(([middleKey, middleValue]) => {
        if ('materials' in middleValue && Array.isArray(middleValue.materials)) {
          // 3-level 구조
          materials.push(...middleValue.materials);
        } else {
          // 4-level 구조
          Object.entries(middleValue).forEach(([subKey, subValue]) => {
            if (Array.isArray(subValue)) {
              materials.push(...subValue);
            } else if (subValue && typeof subValue === 'object' && 'materials' in subValue && Array.isArray(subValue.materials)) {
              materials.push(...subValue.materials);
            }
          });
        }
      });
    });
    
    return materials;
  }, [allData]);

  // 검색 결과 필터링
  const searchResults = useMemo((): NewMaterialData[] => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase().trim();
    return getAllMaterials.filter(material => 
      material.name.toLowerCase().includes(query) ||
      material.category.toLowerCase().includes(query)
    ).slice(0, 20); // 최대 20개 결과만 표시
  }, [searchQuery, getAllMaterials]);

  // 검색에서 재료 추가
  const handleAddMaterialFromSearch = (material: NewMaterialData) => {
    // 이미 추가된 재료인지 확인
    if (selectedMaterials.some(m => m.name === material.name)) return;

    // 물성 데이터 변환
    const properties: { [key: string]: { value: string; unit?: string } } = {};
    let basePrice: { value: string; unit?: string } | undefined;
    let composition: { [key: string]: string } = {};

    material.properties.forEach(prop => {
      if (prop.name === 'Base Metal Price') {
        basePrice = {
          value: prop.scalars,
          unit: prop.units
        };
      } else if (prop.name === 'Alloy Composition') {
        composition['Composition'] = prop.scalars;
      } else {
        properties[prop.name] = {
          value: prop.scalars,
          unit: prop.units
        };
      }
    });

    const newMaterial: SelectedMaterial = {
      id: material.name,
      name: material.name,
      properties,
      composition,
      basePrice,
      active: true,
    };

    setSelectedMaterials(prev => [...prev, newMaterial]);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  // 재료 추가
  const handleAddMaterial = () => {
    if (!selectedDetail) return;

    // 선택된 재료 찾기
    const material = availableMaterials.find(m => m.name === selectedDetail);
    if (!material) return;

    // 이미 추가된 재료인지 확인
    if (selectedMaterials.some(m => m.name === selectedDetail)) return;

    // 물성 데이터 변환
    const properties: { [key: string]: { value: string; unit?: string } } = {};
    let basePrice: { value: string; unit?: string } | undefined;
    let composition: { [key: string]: string } = {};

    material.properties.forEach(prop => {
      if (prop.name === 'Base Metal Price') {
        basePrice = {
          value: prop.scalars,
          unit: prop.units
        };
      } else if (prop.name === 'Alloy Composition') {
        // Composition은 텍스트 형태로 저장되어 있음
        composition['Composition'] = prop.scalars;
      } else {
        properties[prop.name] = {
          value: prop.scalars,
          unit: prop.units
        };
      }
    });

    const newMaterial: SelectedMaterial = {
      id: selectedDetail,
      name: selectedDetail,
      properties,
      composition,
      basePrice,
      active: true,
    };

    setSelectedMaterials(prev => [...prev, newMaterial]);
  };

  // 재료 제거
  const handleRemoveMaterial = (materialId: string) => {
    setSelectedMaterials(prev => prev.filter(m => m.id !== materialId));
  };

  const handleToggleMaterialActive = (materialId: string, active: boolean) => {
    setSelectedMaterials(prev =>
      prev.map(m => (m.id === materialId ? { ...m, active } : m))
    );
  };

  // 모든 재료 제거
  const handleClearAll = () => {
    setSelectedMaterials([]);
  };

  // CSV 다운로드
  const handleDownload = () => {
    if (selectedMaterials.length === 0) return;

    const allProperties = new Set<string>();
    selectedMaterials.forEach(material => {
      Object.keys(material.properties).forEach(prop => allProperties.add(prop));
    });

    const csvData = [
      ['물성', '단위', ...selectedMaterials.map(m => m.name)],
      ...Array.from(allProperties).map(prop => [
        prop,
        selectedMaterials[0]?.properties[prop]?.unit || '',
        ...selectedMaterials.map(m => m.properties[prop]?.value || '')
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '재료_물성_비교.csv';
    link.click();
  };

  // 카테고리 선택 초기화
  const resetSelections = (level: 'major' | 'middle' | 'sub') => {
    if (level === 'major') {
      setSelectedMiddle('');
      setSelectedSub('');
      setSelectedDetail('');
    } else if (level === 'middle') {
      setSelectedSub('');
      setSelectedDetail('');
    } else if (level === 'sub') {
      setSelectedDetail('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">데이터를 불러오는 중...</span>
      </div>
    );
  }

  return (
    <>

      <Tabs defaultValue="properties" className="w-full">
      <TabsList className="grid w-full grid-cols-2 h-12 bg-white">
        <TabsTrigger value="properties" className="text-sm font-semibold">재질별 물성</TabsTrigger>
        <TabsTrigger value="corrosion" className="text-sm font-semibold">부식 호환성</TabsTrigger>
      </TabsList>
      
      <TabsContent value="properties" className="space-y-3 mt-3">
        <div className="space-y-4">
      {/* 재료 선택 섹션 */}
      <Card>
        <CardHeader className="p-6 pb-1">
          <div className="flex items-center gap-3 mb-0">
            <div className="w-1 h-5 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
            <h2 className="text-xl sm:text-2xl font-semibold leading-none tracking-tight">Material Properties</h2>
          </div>
          <div className="text-xs text-gray-500 py-2 ml-4 flex items-center">
            - 물성 데이터는 공개된 표준 규격 및 문헌 자료를 기반으로 합니다. (출처 : MakeItFrom)
            <br />
            - 재질을 추가하면 상대적인 비교를 할 수 있습니다.
          </div>
        </CardHeader>
        <CardContent>
          {/* 드롭다운 선택 섹션 */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3 mb-4">
            {/* 대분류 선택 */}
            <div className="w-full sm:flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2 sr-only">
                대분류를 선택하세요
              </label>
              <Select
                value={selectedMajor}
                onValueChange={(value) => {
                  setSelectedMajor(value);
                  resetSelections('major');
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="대분류를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {majorCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 중분류 선택 */}
            <div className="w-full sm:flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2 sr-only">
                중분류를 선택하세요
              </label>
              <Select
                value={selectedMiddle}
                onValueChange={(value) => {
                  setSelectedMiddle(value);
                  resetSelections('middle');
                }}
                disabled={!selectedMajor}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="중분류를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {middleCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 소분류 선택 */}
            {subCategories.length > 0 && (
              <div className="w-full sm:flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2 sr-only">
                  소분류 선택
                </label>
                <Select
                  value={selectedSub}
                  onValueChange={(value) => {
                    setSelectedSub(value);
                    resetSelections('sub');
                  }}
                  disabled={!selectedMiddle}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="소분류를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {subCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 재료 선택 */}
            <div className="w-full sm:flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2 sr-only">
                재료 선택
              </label>
              <Select
                value={selectedDetail}
                onValueChange={(value) => setSelectedDetail(value)}
                disabled={!selectedMiddle || (subCategories.length > 0 && !selectedSub)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="재질을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {availableMaterials.map((material) => (
                    <SelectItem key={material.name} value={material.name}>
                      {material.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 재료 추가 버튼 - 가장 오른쪽에 배치 */}
            <div className="ml-auto">
              <button
                onClick={handleAddMaterial}
                disabled={!selectedDetail}
                className="w-[120px] h-8 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              >
                재질 추가
              </button>
            </div>
          </div>

          {/* 검색 섹션 */}
          <div className="mb-4 relative">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="재료명으로 검색하세요 (예: 316, 625, Stainless, Alloy)"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(e.target.value.trim().length > 0);
                  }}
                  className="pl-10 h-8 text-sm"
                />
              </div>
              {searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchResults(false);
                  }}
                  className="h-10"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {/* 검색 결과 */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((material, index) => (
                  <div
                    key={`${material.name}-${index}`}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => handleAddMaterialFromSearch(material)}
                  >
                    <div className="font-medium text-sm text-gray-900">{material.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{material.category}</div>
                    {material.description && (
                      <div className="text-xs text-gray-400 mt-1 truncate">{getKoreanSummary(material.description)}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {showSearchResults && searchQuery && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3">
                <div className="text-sm text-gray-500 text-center">검색 결과가 없습니다.</div>
              </div>
            )}
          </div>

          {/* 선택된 재료 목록 */}
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedMaterials.map(material => (
              <div key={material.id} className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-50 rounded-md border border-gray-200 text-xs">
                <button
                  title={`Toggle visibility of ${material.name}`}
                  aria-label={`Toggle visibility of ${material.name}`}
                  onClick={() => handleToggleMaterialActive(material.id, !material.active)}
                  className={`relative inline-flex h-3 w-6 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${material.active ? 'bg-blue-500' : 'bg-gray-200'}`}
                >
                  <span
                    className={`inline-block h-2 w-2 transform rounded-full bg-white transition-transform duration-200 ${material.active ? 'translate-x-3' : 'translate-x-0.5'}`}
                  ></span>
                </button>
                <label
                  data-slot="label"
                  className="flex items-center gap-2 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-xs font-medium text-gray-700 cursor-pointer max-w-[150px] sm:max-w-[150px] truncate"
                  title={material.name}
                >
                  {material.name}
                </label>
                <button
                  onClick={() => handleRemoveMaterial(material.id)}
                  className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-md h-4 w-4 p-0 hover:bg-red-100 hover:text-red-600 text-gray-400"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 물성 비교 섹션 */}
      {selectedMaterials.length > 0 && (
        <Card>
          <CardHeader>
            
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* PROPERTIES 섹션 */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-blue-600 border-b border-blue-200 pb-2">
                  PROPERTIES
                </h3>
                
                {/* 모바일에서는 카드 레이아웃, 데스크톱에서는 테이블 */}
                <div className="block sm:hidden">
                  {/* 모바일 카드 레이아웃 */}
                  <div className="space-y-4">
                    {(() => {
                      // 모든 재료의 물성 키를 수집 (Alloy Composition과 Base Metal Price 제외)
                      const allPropertyKeys = new Set<string>();
                      selectedMaterials.filter(m => m.active).forEach(material => {
                        Object.keys(material.properties || {}).forEach(key => {
                          if (key !== 'Alloy Composition' && key !== 'Base Metal Price') {
                            allPropertyKeys.add(key);
                          }
                        });
                      });
                      
                      return sortPropertiesByOrder(Array.from(allPropertyKeys)).map((propertyKey) => {
                        const koreanInfo = propertyKoreanNames[propertyKey];
                        const firstMaterial = selectedMaterials.find(m => m.active && m.properties[propertyKey]);
                        const unit = firstMaterial?.properties[propertyKey]?.unit;
                        
                        return (
                          <div key={propertyKey} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="mb-3">
                              <h4 className="text-sm font-semibold text-gray-900">
                                {koreanInfo?.korean ? `${koreanInfo.korean}` : propertyKey}
                              </h4>
                              <p className="text-xs text-gray-500 mt-1">
                                {propertyKey} {unit && (
                                  <span className="font-mono">
                                    (<span dangerouslySetInnerHTML={{ __html: formatUnit(unit) }} />)
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="space-y-2">
                              {selectedMaterials.filter(m => m.active).map((material, index) => (
                                <div key={index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                                  <span className="text-sm font-medium text-gray-700 truncate max-w-[60%]">
                                    {material.name}
                                  </span>
                                  <span className="text-sm font-semibold text-gray-900">
                                    {formatRangeValue(material.properties[propertyKey]?.value || '-')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* 데스크톱 테이블 레이아웃 */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full border-collapse table-fixed">
                    {/* 헤더 */}
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th 
                          className="text-left py-2 px-3 text-sm font-medium text-gray-600 bg-gray-50"
                          style={{ width: '300px' }}
                        >
                          물성
                        </th>
                        <th 
                            className="text-center py-2 px-3 text-sm font-medium text-gray-600 bg-gray-50"
                            style={{ width: '100px' }}
                          >
                            단위
                          </th>
                        {selectedMaterials.filter(m => m.active).map((material, index) => (
                          <th 
                            key={index} 
                            className="text-center py-2 px-3 text-sm font-medium text-gray-600 bg-blue-50"
                            style={{ width: `${100 / (selectedMaterials.filter(m => m.active).length + 2)}%` }}
                          >
                            <div className="truncate" title={material.name}>
                              {material.name}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    
                    {/* 물성 데이터 */}
                     <tbody>
                       {(() => {
                         // 모든 재료의 물성 키를 수집 (Alloy Composition과 Base Metal Price 제외)
                         const allPropertyKeys = new Set<string>();
                         selectedMaterials.filter(m => m.active).forEach(material => {
                           Object.keys(material.properties || {}).forEach(key => {
                             if (key !== 'Alloy Composition' && key !== 'Base Metal Price') {
                               allPropertyKeys.add(key);
                             }
                           });
                         });
                         
                         return sortPropertiesByOrder(Array.from(allPropertyKeys)).map((propertyKey) => {
                           const koreanInfo = propertyKoreanNames[propertyKey];
                           // 첫 번째 재료에서 단위 정보 가져오기
                           const firstMaterial = selectedMaterials.find(m => m.active && m.properties[propertyKey]);
                           const unit = firstMaterial?.properties[propertyKey]?.unit;
                           
                           return (
                             <tr key={propertyKey} className="border-b border-gray-100 hover:bg-gray-50">
                               <td className="py-1 px-3">
                                 <div className="text-xs font-medium text-gray-900 leading-tight">
                                   {koreanInfo?.korean ? `${koreanInfo.korean} (${propertyKey})` : propertyKey}
                                 </div>
                               </td>
                               <td className="py-1 px-3 text-center">
                                 <div className="text-xs text-gray-600 font-mono">
                                   {unit ? <span dangerouslySetInnerHTML={{ __html: formatUnit(unit) }} /> : '-'}
                                 </div>
                               </td>
                               {selectedMaterials.filter(m => m.active).map((material, index) => (
                                 <td key={index} className="py-1 px-3 text-center">
                                   <div className="text-xs font-medium text-gray-900">
                                     {formatRangeValue(material.properties[propertyKey]?.value || '-')}
                                   </div>
                                 </td>
                               ))}
                             </tr>
                           );
                         });
                       })()}
                     </tbody>
                  </table>
                </div>
              </div>

              {/* COMPOSITION 섹션 */}
              {(() => {
                // 안전한 composition 데이터 파싱 함수
                const parseCompositionData = (compositionString: string): Array<{symbol: string, percentage: string}> => {
                  if (!compositionString) return [];
                  
                  try {
                    // JSON 형태로 파싱 시도
                    const parsed = JSON.parse(compositionString);
                    if (Array.isArray(parsed)) {
                      return parsed.filter(item => item.symbol && item.percentage);
                    }
                  } catch (error) {
                    // JSON 파싱 실패 시 텍스트 파싱 시도
                    console.warn('JSON 파싱 실패, 텍스트 파싱 시도:', error);
                    
                    // 텍스트에서 원소와 퍼센트 추출 시도
                    // 예: "C: 0.08%, Cr: 18-20%, Ni: 8-10.5%" 형태
                    const elements: Array<{symbol: string, percentage: string}> = [];
                    
                    // 쉼표로 분리하여 각 원소 처리
                    const parts = compositionString.split(',');
                    for (const part of parts) {
                      const trimmed = part.trim();
                      // "원소명: 퍼센트%" 패턴 매칭
                      const match = trimmed.match(/([A-Za-z]+)\s*:\s*([0-9.-]+(?:\s*to\s*[0-9.-]+)?)\s*%?/);
                      if (match) {
                        elements.push({
                          symbol: match[1],
                          percentage: match[2] + '%'
                        });
                      }
                    }
                    
                    if (elements.length > 0) {
                      return elements;
                    }
                  }
                  
                  return [];
                };

                // 모든 재료의 합금 원소를 수집
                const allElements = new Set<string>();
                selectedMaterials.filter(m => m.active && m.composition).forEach(material => {
                  if (material.composition?.Composition) {
                    const compositionData = parseCompositionData(material.composition.Composition);
                    compositionData.forEach(element => {
                      allElements.add(element.symbol);
                    });
                  }
                });

                const sortedElements = sortElementsByOrder(Array.from(allElements));

                if (sortedElements.length === 0) return null;

                return (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-green-600 border-b border-green-200 pb-2">
                      Chemical Composition
                    </h3>
                    
                    {/* 모바일에서는 카드 레이아웃, 데스크톱에서는 테이블 */}
                    <div className="block sm:hidden">
                      {/* 모바일 카드 레이아웃 */}
                      <div className="space-y-4">
                        {sortedElements.map((symbol, elementIndex) => (
                          <div key={elementIndex} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="mb-3">
                              <h4 className="text-sm font-semibold text-gray-900">
                                {elementKoreanNames[symbol] ? `${elementKoreanNames[symbol]}` : symbol}
                              </h4>
                              <p className="text-xs text-gray-500 mt-1">
                                {symbol} (%)
                              </p>
                            </div>
                            <div className="space-y-2">
                              {selectedMaterials.filter(m => m.active).map((material, materialIndex) => {
                                // 해당 재료의 composition 데이터 파싱
                                const compositionData = material.composition?.Composition 
                                  ? parseCompositionData(material.composition.Composition)
                                  : [];
                                
                                // 해당 원소의 데이터 찾기
                                const elementData = compositionData.find(element => element.symbol === symbol);
                                
                                const value = elementData 
                                  ? elementData.percentage.replace(/ to /g, '~').replace(/%/g, '')
                                  : '-';

                                return (
                                  <div key={materialIndex} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                                    <span className="text-sm font-medium text-gray-700 truncate max-w-[60%]">
                                      {material.name}
                                    </span>
                                    <span className="text-sm font-semibold text-gray-900">
                                      {value}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 데스크톱 테이블 레이아웃 */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full border-collapse table-fixed">
                        {/* 헤더 */}
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th 
                              className="text-left py-2 px-3 text-sm font-medium text-gray-600 bg-gray-50"
                              style={{ width: '300px' }}
                            >
                              원소
                            </th>
                            <th 
                              className="text-center py-2 px-3 text-sm font-medium text-gray-600 bg-gray-50"
                              style={{ width: '100px' }}
                            >
                              단위
                            </th>
                            {selectedMaterials.filter(m => m.active).map((material, index) => (
                              <th 
                                key={index} 
                                className="text-center py-2 px-3 text-sm font-medium text-gray-600 bg-green-50"
                                style={{ width: `${100 / (selectedMaterials.filter(m => m.active).length + 2)}%` }}
                              >
                                <div className="truncate" title={material.name}>
                                  {material.name}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        
                        {/* 원소별 데이터 */}
                        <tbody>
                          {sortedElements.map((symbol, elementIndex) => (
                            <tr key={elementIndex} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-1 px-3">
                                <div className="text-xs font-medium text-gray-900 leading-tight">
                                  {elementKoreanNames[symbol] ? `${elementKoreanNames[symbol]}(${symbol})` : symbol}
                                </div>
                              </td>
                              <td className="py-1 px-3 text-center">
                                <div className="text-xs text-gray-600 font-mono">
                                  %
                                </div>
                              </td>
                              {selectedMaterials.filter(m => m.active).map((material, materialIndex) => {
                                // 해당 재료의 composition 데이터 파싱
                                const compositionData = material.composition?.Composition 
                                  ? parseCompositionData(material.composition.Composition)
                                  : [];
                                
                                // 해당 원소의 데이터 찾기
                                const elementData = compositionData.find(element => element.symbol === symbol);
                                
                                const value = elementData 
                                  ? elementData.percentage.replace(/ to /g, '~').replace(/%/g, '')
                                  : '-';

                                return (
                                  <td key={materialIndex} className="py-1 px-3 text-center">
                                    <div className="text-xs font-medium text-gray-900">
                                      {value}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* BASE PRICE 섹션 */}
              {selectedMaterials.some(material => material.basePrice) && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-purple-600 border-b border-purple-200 pb-2">
                    Reference Price
                  </h3>
                  
                  {/* 모바일에서는 카드 레이아웃, 데스크톱에서는 테이블 */}
                  <div className="block sm:hidden">
                    {/* 모바일 카드 레이아웃 */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="mb-3">
                        <h4 className="text-sm font-semibold text-gray-900">
                          기본 금속 가격
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Base Metal Price ({selectedMaterials.find(m => m.active && m.basePrice)?.basePrice?.unit === '%' ? '%rel' : selectedMaterials.find(m => m.active && m.basePrice)?.basePrice?.unit || '-'})
                        </p>
                      </div>
                      <div className="space-y-2">
                        {selectedMaterials.filter(m => m.active).map((material, index) => (
                          <div key={index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                            <span className="text-sm font-medium text-gray-700 truncate max-w-[60%]">
                              {material.name}
                            </span>
                            <span className="text-sm font-semibold text-gray-900">
                              {material.basePrice ? formatRangeValue(material.basePrice.value) : '-'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 데스크톱 테이블 레이아웃 */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full border-collapse table-fixed">
                      {/* 헤더 */}
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th 
                            className="text-left py-2 px-3 text-sm font-medium text-gray-600 bg-gray-50"
                            style={{ width: '300px' }}
                          >
                            가격 지수
                          </th>
                          <th 
                            className="text-center py-2 px-3 text-sm font-medium text-gray-600 bg-gray-50"
                            style={{ width: '100px' }}
                          >
                            단위
                          </th>
                          {selectedMaterials.filter(m => m.active).map((material, index) => (
                            <th 
                              key={index} 
                              className="text-center py-2 px-3 text-sm font-medium text-gray-600 bg-blue-50"
                              style={{ width: `${100 / (selectedMaterials.filter(m => m.active).length + 2)}%` }}
                            >
                              <div className="truncate" title={material.name}>
                                {material.name}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      
                      {/* 가격 데이터 */}
                      <tbody>
                        <tr className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-3">
                            <div className="text-xs font-medium text-gray-900">
                              기본 금속 가격
                            </div>
                            <div className="text-xs text-gray-500">
                              Base Metal Price
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="text-xs text-gray-600">
                              {selectedMaterials.find(m => m.active && m.basePrice)?.basePrice?.unit === '%' ? '%rel' : selectedMaterials.find(m => m.active && m.basePrice)?.basePrice?.unit || '-'}
                            </div>
                          </td>
                          {selectedMaterials.filter(m => m.active).map((material, index) => (
                            <td key={index} className="py-2 px-3 text-center">
                              <div className="text-xs text-gray-700">
                                {material.basePrice ? formatRangeValue(material.basePrice.value) : '-'}
                              </div>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 빈 상태 메시지 */}
      {selectedMaterials.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-gray-500">
              <Plus className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">재질을 선택해주세요</p>
              <p className="text-sm">
                  위에서 재질을 선택하면 물성 정보를 비교할 수 있습니다.
                </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>데이터를 로드하는 중...</span>
        </div>
      )}
        </div>
      </TabsContent>
      
      <TabsContent value="corrosion" className="mt-6">
        <CorrosionCompatibility selectedMaterials={selectedMaterials} />
      </TabsContent>
    </Tabs>
  </>);
}