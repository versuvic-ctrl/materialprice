import {
  MakeItFromMaterial,
  MakeItFromDatabase,
  MaterialComparisonItem,
  PropertyComparison,
  MaterialFilter,
  MaterialSearchResult,
  COMMON_PROPERTIES,
  MakeItFromProperty,
  MajorCategory, 
  MiddleCategory, 
  CategoryHierarchy,
  MAJOR_CATEGORIES,
  METAL_CATEGORIES,
  POLYMERIC_CATEGORIES,
  CERAMIC_CATEGORIES
} from '@/types/makeItFrom';

// 숫자 값 파싱 함수
export function parseNumericValue(scalarValue: string): number | null {
  // "1.7 to 13", "230 to 590", "72" 등의 형태를 처리
  const cleanValue = scalarValue.replace(/[^\d.-]/g, '');
  
  if (scalarValue.includes(' to ')) {
    // 범위 값인 경우 평균값 계산
    const parts = scalarValue.split(' to ');
    const min = parseFloat(parts[0].replace(/[^\d.-]/g, ''));
    const max = parseFloat(parts[1].replace(/[^\d.-]/g, ''));
    
    if (!isNaN(min) && !isNaN(max)) {
      return (min + max) / 2;
    }
  }
  
  const singleValue = parseFloat(cleanValue);
  return isNaN(singleValue) ? null : singleValue;
}

// 재료 검색 함수
export function searchMaterials(
  database: MakeItFromDatabase,
  searchTerm: string,
  limit: number = 20
): MaterialSearchResult[] {
  if (!searchTerm.trim()) return [];

  const results: MaterialSearchResult[] = [];
  const searchLower = searchTerm.toLowerCase();

  database.forEach((material) => {
    let score = 0;
    const matchedProperties: string[] = [];

    // 재료 이름에서 검색
    material.names.forEach((name) => {
      if (name.toLowerCase().includes(searchLower)) {
        score += 10;
      }
    });

    // 카테고리에서 검색
    if (material.category.toLowerCase().includes(searchLower)) {
      score += 5;
    }

    // 속성 이름에서 검색
    material.properties.forEach((prop) => {
      if (prop.name.toLowerCase().includes(searchLower)) {
        score += 3;
        matchedProperties.push(prop.name);
      }
    });

    // 조성에서 검색 (있는 경우)
    if (material.composition) {
      material.composition.forEach((comp) => {
        if (comp.element.toLowerCase().includes(searchLower)) {
          score += 2;
        }
      });
    }

    if (score > 0) {
      results.push({
        material,
        score,
        matchedProperties
      });
    }
  });

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// 재료 필터링 함수
export function filterMaterials(
  database: MakeItFromDatabase,
  filter: MaterialFilter
): MakeItFromMaterial[] {
  return database.filter((material) => {
    // 카테고리 필터
    if (filter.category && material.category !== filter.category) {
      return false;
    }

    // 검색어 필터
    if (filter.searchTerm) {
      const searchLower = filter.searchTerm.toLowerCase();
      const nameMatch = material.names.some(name => 
        name.toLowerCase().includes(searchLower)
      );
      const categoryMatch = material.category.toLowerCase().includes(searchLower);
      const propertyMatch = material.properties.some(prop => 
        prop.name.toLowerCase().includes(searchLower)
      );
      
      if (!nameMatch && !categoryMatch && !propertyMatch) {
        return false;
      }
    }

    // 속성 필터 (특정 속성을 가진 재료만)
    if (filter.properties && filter.properties.length > 0) {
      const materialProperties = material.properties.map(p => p.name);
      const hasRequiredProperties = filter.properties.every(requiredProp =>
        materialProperties.includes(requiredProp)
      );
      
      if (!hasRequiredProperties) {
        return false;
      }
    }

    return true;
  });
}

// 재료 비교 데이터 생성
export function createMaterialComparison(
  materials: MaterialComparisonItem[]
): PropertyComparison[] {
  if (materials.length === 0) return [];

  // 모든 재료의 속성을 수집
  const allProperties = new Map<string, Set<string>>();
  
  materials.forEach((item) => {
    item.material.properties.forEach((prop) => {
      if (!allProperties.has(prop.name)) {
        allProperties.set(prop.name, new Set());
      }
      allProperties.get(prop.name)!.add(prop.units);
    });
  });

  const comparisons: PropertyComparison[] = [];

  // 각 속성에 대해 비교 데이터 생성
  allProperties.forEach((units, propertyName) => {
    const values = materials.map((item) => {
      const property = item.material.properties.find(p => p.name === propertyName);
      
      return {
        materialId: item.id,
        materialName: item.displayName,
        value: property ? property.scalars : '-',
        numericValue: property ? parseNumericValue(property.scalars) : null
      };
    });

    // 적어도 하나의 재료가 이 속성을 가지고 있는 경우만 포함
    if (values.some(v => v.value !== '-')) {
      comparisons.push({
        propertyName,
        unit: Array.from(units)[0] || '', // 첫 번째 단위 사용
        values
      });
    }
  });

  // 공통 속성을 먼저 정렬하고, 나머지는 알파벳 순으로 정렬
  return comparisons.sort((a, b) => {
    const aIsCommon = COMMON_PROPERTIES.includes(a.propertyName as any);
    const bIsCommon = COMMON_PROPERTIES.includes(b.propertyName as any);
    
    if (aIsCommon && !bIsCommon) return -1;
    if (!aIsCommon && bIsCommon) return 1;
    
    if (aIsCommon && bIsCommon) {
      const aIndex = COMMON_PROPERTIES.indexOf(a.propertyName as any);
      const bIndex = COMMON_PROPERTIES.indexOf(b.propertyName as any);
      return aIndex - bIndex;
    }
    
    return a.propertyName.localeCompare(b.propertyName);
  });
}

// 재료의 주요 속성 추출
export function getKeyProperties(material: MakeItFromMaterial): MakeItFromProperty[] {
  const keyPropertyNames = [
    'Density',
    'Elastic (Young\'s, Tensile) Modulus',
    'Tensile Strength: Ultimate (UTS)',
    'Thermal Conductivity'
  ];

  return material.properties.filter(prop => 
    keyPropertyNames.includes(prop.name)
  );
}

// 기존 카테고리를 MakeItFrom.com 계층적 카테고리로 매핑하는 함수
export const mapToMakeItFromCategory = (originalCategory: string): CategoryHierarchy => {
  const categoryLower = originalCategory.toLowerCase();
  
  // 금속 관련 세부 매핑
  if (categoryLower.includes('aluminum') || categoryLower.includes('aluminium')) {
    return { major: 'Metals', middle: 'Aluminum Alloy' };
  }
  if (categoryLower.includes('cobalt')) {
    return { major: 'Metals', middle: 'Cobalt Alloy' };
  }
  if (categoryLower.includes('copper') || categoryLower.includes('brass') || categoryLower.includes('bronze')) {
    return { major: 'Metals', middle: 'Copper Alloy' };
  }
  if (categoryLower.includes('iron') || categoryLower.includes('steel') || categoryLower.includes('ferrous')) {
    return { major: 'Metals', middle: 'Iron Alloy' };
  }
  if (categoryLower.includes('magnesium')) {
    return { major: 'Metals', middle: 'Magnesium Alloy' };
  }
  if (categoryLower.includes('nickel')) {
    return { major: 'Metals', middle: 'Nickel Alloy' };
  }
  if (categoryLower.includes('titanium')) {
    return { major: 'Metals', middle: 'Titanium Alloy' };
  }
  if (categoryLower.includes('zinc')) {
    return { major: 'Metals', middle: 'Zinc Alloy' };
  }
  if (categoryLower.includes('metal')) {
    return { major: 'Metals', middle: 'Other Metal Alloy' };
  }
  
  // 폴리머 관련 세부 매핑
  if (categoryLower.includes('thermoplastic')) {
    return { major: 'Polymerics', middle: 'Thermoplastic' };
  }
  if (categoryLower.includes('thermoset') && (categoryLower.includes('elastomer') || categoryLower.includes('rubber'))) {
    return { major: 'Polymerics', middle: 'Thermoset Elastomer Rubber' };
  }
  if (categoryLower.includes('thermoset')) {
    return { major: 'Polymerics', middle: 'Thermoset Plastic' };
  }
  if (categoryLower.includes('wood')) {
    return { major: 'Polymerics', middle: 'Wood Based Material' };
  }
  if (categoryLower.includes('polymer') || categoryLower.includes('plastic')) {
    return { major: 'Polymerics', middle: 'Thermoplastic' };
  }
  
  // 세라믹 관련 세부 매핑
  if (categoryLower.includes('glass')) {
    return { major: 'Ceramics', middle: 'Glass and Glass Ceramic' };
  }
  if (categoryLower.includes('stone') || categoryLower.includes('natural')) {
    return { major: 'Ceramics', middle: 'Natural Stone' };
  }
  if (categoryLower.includes('optical')) {
    return { major: 'Ceramics', middle: 'Non-Glass Optical Ceramic' };
  }
  if (categoryLower.includes('oxide')) {
    return { major: 'Ceramics', middle: 'Oxide Based Engineering Ceramic' };
  }
  if (categoryLower.includes('ceramic') || categoryLower.includes('carbide') || categoryLower.includes('nitride')) {
    return { major: 'Ceramics', middle: 'Non-Oxide Engineering Ceramic' };
  }
  
  // 기본값 - 기타 금속으로 분류
  return { major: 'Metals', middle: 'Other Metal Alloy' };
};

// 대분류에서 중분류 목록을 가져오는 함수
export const getMiddleCategoriesByMajor = (majorCategory: MajorCategory): readonly MiddleCategory[] => {
  switch (majorCategory) {
    case 'Metals':
      return METAL_CATEGORIES;
    case 'Polymerics':
      return POLYMERIC_CATEGORIES;
    case 'Ceramics':
      return CERAMIC_CATEGORIES;
    default:
      return [];
  }
};

// 재료 카테고리 추출 (MakeItFrom.com 구조로 변환)
export function extractCategories(database: MakeItFromDatabase): string[] {
  const categories = new Set<string>();
  
  // MakeItFrom.com 표준 카테고리 추가
  const standardCategories = [
    'Metals > Aluminum Alloys',
    'Metals > Cobalt Alloys',
    'Metals > Copper Alloys',
    'Metals > Iron Alloys',
    'Metals > Magnesium Alloys',
    'Metals > Nickel Alloys',
    'Metals > Titanium Alloys',
    'Metals > Zinc Alloys',
    'Metals > Otherwise Unclassified Metals',
    'Polymerics > Thermoplastics',
    'Polymerics > Thermoset Elastomers (Rubber)',
    'Polymerics > Thermoset Plastics',
    'Polymerics > Wood-Based Materials',
    'Ceramics > Glass and Glass-Ceramics',
    'Ceramics > Natural Stone',
    'Ceramics > Non-Glass Optical Ceramics',
    'Ceramics > Non-Oxide Engineering Ceramics',
    'Ceramics > Oxide-Based Engineering Ceramics'
  ];

  // 표준 카테고리를 먼저 추가
  standardCategories.forEach(cat => categories.add(cat));

  // 데이터베이스의 재료들을 매핑된 카테고리로 추가
  database.forEach(material => {
    const mappedCategory = mapToMakeItFromCategory(material.category);
    categories.add(mappedCategory);
  });

  return Array.from(categories).sort();
}

// 재료 이름 정리 (표시용)
export function formatMaterialName(material: MakeItFromMaterial): string {
  // URL에서 재료 이름 추출
  if (material.references && material.references.length > 0) {
    const url = material.references[0].url;
    const urlParts = url.split('/');
    const materialPart = urlParts[urlParts.length - 1];
    
    // URL에서 재료 이름 파싱 (예: "7075-AlZn5.5MgCu-3.4365-2L95-A97075-Aluminum")
    if (materialPart) {
      // 마지막 하이픈 이후의 재료 타입과 첫 번째 부분을 조합
      const parts = materialPart.split('-');
      if (parts.length >= 2) {
        const materialType = parts[parts.length - 1]; // "Aluminum"
        const materialCode = parts[0]; // "7075"
        const name = `${materialCode} ${materialType}`;
        return name.length > 50 ? name.substring(0, 47) + '...' : name;
      }
    }
  }
  
  return 'Unknown Material';
}

// 속성 값 비교 (정렬용)
export function comparePropertyValues(a: string, b: string): number {
  const numA = parseNumericValue(a);
  const numB = parseNumericValue(b);
  
  if (numA === null && numB === null) return 0;
  if (numA === null) return 1;
  if (numB === null) return -1;
  
  return numA - numB;
}

// 재료 ID 생성
export function generateMaterialId(material: MakeItFromMaterial, index: number): string {
  const name = formatMaterialName(material);
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `${cleanName}_${index}`;
}