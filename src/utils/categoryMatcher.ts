import { MakeItFromMaterial } from '@/types/makeItFrom';

// 카테고리 구조 타입 정의 (4단계)
export interface CategoryStructure {
  [majorCategory: string]: {
    [middleCategory: string]: {
      [subCategory: string]: string[];
    };
  };
}

// 자재 카테고리 정보 타입 (4단계)
export interface MaterialCategory {
  major: string;
  middle: string;
  sub: string;
  detail: string;
}

/**
 * 자재 URL에서 카테고리를 추출하는 함수
 */
export function extractCategoryFromUrl(url: string): MaterialCategory | null {
  try {
    // URL에서 자재명 추출
    const urlParts = url.split('/');
    const materialName = urlParts[urlParts.length - 1];
    
    // 자재명을 기반으로 카테고리 추론
    return inferCategoryFromMaterialName(materialName);
  } catch (error) {
    console.error('URL에서 카테고리 추출 실패:', error);
    return null;
  }
}

/**
 * 자재명을 기반으로 카테고리를 추론하는 함수 (4단계)
 */
export function inferCategoryFromMaterialName(materialName: string): MaterialCategory | null {
  const name = materialName.toLowerCase();
  
  // Aluminum 계열
  if (name.includes('aluminum') || name.includes('al99') || name.includes('alz') || 
      name.includes('almg') || name.includes('alsi') || name.includes('alcu') ||
      /^\d{4}/.test(materialName) && (name.includes('aluminum') || name.includes('al'))) {
    
    // AA 1000 시리즈 분류
    if (name.includes('1050') && name.includes('a91050')) {
      return {
        major: 'Metals',
        middle: 'Aluminum Alloys',
        sub: 'AA 1000 Series (Commercially Pure Wrought Aluminum)',
        detail: '1050 (A91050) Aluminum'
      };
    }
    if (name.includes('1060') && name.includes('a91060')) {
      return {
        major: 'Metals',
        middle: 'Aluminum Alloys',
        sub: 'AA 1000 Series (Commercially Pure Wrought Aluminum)',
        detail: '1060 (Al99.6, A91060) Aluminum'
      };
    }
    if (name.includes('1070') && !name.includes('1070a')) {
      return {
        major: 'Metals',
        middle: 'Aluminum Alloys',
        sub: 'AA 1000 Series (Commercially Pure Wrought Aluminum)',
        detail: '1070 (Al99.7) Aluminum'
      };
    }
    if (name.includes('1100') && name.includes('a91100')) {
      return {
        major: 'Metals',
        middle: 'Aluminum Alloys',
        sub: 'AA 1000 Series (Commercially Pure Wrought Aluminum)',
        detail: '1100 (Al99.0Cu, A91100) Aluminum'
      };
    }
    // 기타 1000 시리즈
    if (name.includes('1000') || name.includes('1050') || name.includes('1060') || 
        name.includes('1070') || name.includes('1080') || name.includes('1100') ||
        name.includes('1200') || name.includes('1350')) {
      return {
        major: 'Metals',
        middle: 'Aluminum Alloys',
        sub: 'AA 1000 Series (Commercially Pure Wrought Aluminum)',
        detail: materialName
      };
    }
    
    if (name.includes('2000') || name.includes('2024') || name.includes('2014') ||
        name.includes('2017') || name.includes('2219')) {
      return {
        major: 'Metals',
        middle: 'Aluminum Alloys',
        sub: 'AA 2000 Series (Aluminum-Copper Wrought Alloy)',
        detail: materialName
      };
    }
    
    if (name.includes('3000') || name.includes('3003') || name.includes('3004') ||
        name.includes('3105')) {
      return {
        major: 'Metals',
        middle: 'Aluminum Alloys',
        sub: 'AA 3000 Series (Aluminum-Manganese Wrought Alloy)',
        detail: materialName
      };
    }
    
    if (name.includes('4000') || name.includes('4043') || name.includes('4047')) {
      return {
        major: 'Metals',
        middle: 'Aluminum Alloys',
        sub: 'AA 4000 Series (Aluminum-Silicon Wrought Alloy)',
        detail: materialName
      };
    }
    
    if (name.includes('5000') || name.includes('5052') || name.includes('5083') ||
        name.includes('5086') || name.includes('5454')) {
      return {
        major: 'Metals',
        middle: 'Aluminum Alloys',
        sub: 'AA 5000 Series (Aluminum-Magnesium Wrought Alloy)',
        detail: materialName
      };
    }
    
    if (name.includes('6000') || name.includes('6061') || name.includes('6063') ||
        name.includes('6082') || name.includes('6110')) {
      return {
        major: 'Metals',
        middle: 'Aluminum Alloys',
        sub: 'AA 6000 Series (Aluminum-Magnesium-Silicon Wrought Alloy)',
        detail: materialName
      };
    }
    
    if (name.includes('7000') || name.includes('7075') || name.includes('7050') ||
        name.includes('7178')) {
      return {
        major: 'Metals',
        middle: 'Aluminum Alloys',
        sub: 'AA 7000 Series (Aluminum-Zinc Wrought Alloy)',
        detail: materialName
      };
    }
    
    // 기타 알루미늄
    return {
      major: 'Metals',
      middle: 'Aluminum Alloys',
      sub: 'Otherwise Unclassified Aluminum',
      detail: materialName
    };
  }
  
  // Steel 계열
  if (name.includes('steel') || name.includes('stainless') || name.includes('uns s') ||
      name.includes('aisi') || name.includes('astm a')) {
    
    if (name.includes('stainless')) {
      return {
        major: 'Metals',
        middle: 'Iron Alloys',
        sub: 'Stainless Steel',
        detail: materialName
      };
    }
    
    if (name.includes('carbon') || name.includes('mild')) {
      return {
        major: 'Metals',
        middle: 'Iron Alloys',
        sub: 'Carbon Steel',
        detail: materialName
      };
    }
    
    if (name.includes('alloy') && name.includes('steel')) {
      return {
        major: 'Metals',
        middle: 'Iron Alloys',
        sub: 'Alloy Steel',
        detail: materialName
      };
    }
    
    if (name.includes('tool')) {
      return {
        major: 'Metals',
        middle: 'Iron Alloys',
        sub: 'Tool Steel',
        detail: materialName
      };
    }
    
    if (name.includes('cast') && name.includes('iron')) {
      return {
        major: 'Metals',
        middle: 'Iron Alloys',
        sub: 'Cast Iron',
        detail: materialName
      };
    }
    
    return {
      major: 'Metals',
      middle: 'Iron Alloys',
      sub: 'Otherwise Unclassified Iron',
      detail: materialName
    };
  }
  
  // Copper 계열
  if (name.includes('copper') || name.includes('brass') || name.includes('bronze') ||
      name.includes('cu') && (name.includes('alloy') || name.includes('c1'))) {
    
    if (name.includes('brass')) {
      return {
        major: 'Metals',
        middle: 'Copper Alloys',
        sub: 'Brass',
        detail: materialName
      };
    }
    
    if (name.includes('bronze')) {
      return {
        major: 'Metals',
        middle: 'Copper Alloys',
        sub: 'Bronze',
        detail: materialName
      };
    }
    
    if (name.includes('nickel') && name.includes('copper')) {
      return {
        major: 'Metals',
        middle: 'Copper Alloys',
        sub: 'Copper-Nickel Alloys',
        detail: materialName
      };
    }
    
    return {
      major: 'Metals',
      middle: 'Copper Alloys',
      sub: 'Otherwise Unclassified Copper',
      detail: materialName
    };
  }
  
  // Titanium 계열
  if (name.includes('titanium') || name.includes('ti-') || name.includes('grade')) {
    return {
      major: 'Metals',
      middle: 'Titanium Alloys',
      sub: 'Otherwise Unclassified Titanium',
      detail: materialName
    };
  }
  
  // Nickel 계열
  if (name.includes('nickel') || name.includes('inconel') || name.includes('hastelloy') ||
      name.includes('monel')) {
    
    if (name.includes('chromium') || name.includes('inconel')) {
      return {
        major: 'Metals',
        middle: 'Nickel Alloys',
        sub: 'Nickel-Chromium Alloys',
        detail: materialName
      };
    }
    
    if (name.includes('superalloy') || name.includes('inconel') || name.includes('hastelloy')) {
      return {
        major: 'Metals',
        middle: 'Nickel Alloys',
        sub: 'Superalloys',
        detail: materialName
      };
    }
    
    return {
      major: 'Metals',
      middle: 'Nickel Alloys',
      sub: 'Otherwise Unclassified Nickel',
      detail: materialName
    };
  }
  
  // Magnesium 계열
  if (name.includes('magnesium') || name.includes('mg')) {
    return {
      major: 'Metals',
      middle: 'Magnesium Alloys',
      sub: 'Otherwise Unclassified Magnesium',
      detail: materialName
    };
  }
  
  // Zinc 계열
  if (name.includes('zinc') || name.includes('zn')) {
    return {
      major: 'Metals',
      middle: 'Zinc Alloys',
      sub: 'Otherwise Unclassified Zinc',
      detail: materialName
    };
  }
  
  // Cobalt 계열
  if (name.includes('cobalt') || name.includes('co')) {
    return {
      major: 'Metals',
      middle: 'Cobalt Alloys',
      sub: 'Otherwise Unclassified Cobalt',
      detail: materialName
    };
  }
  
  // Zirconium 계열
  if (name.includes('zirconium') || name.includes('zr')) {
    return {
      major: 'Metals',
      middle: 'Otherwise Unclassified Metals',
      sub: 'Refractory Metals',
      detail: materialName
    };
  }
  
  // Polymer 계열
  if (name.includes('polymer') || name.includes('plastic') || name.includes('resin') ||
      name.includes('acrylonitrile') || name.includes('styrene') || name.includes('polyethylene') ||
      name.includes('polypropylene') || name.includes('pvc') || name.includes('abs') ||
      name.includes('asa') || name.includes('pc') || name.includes('pa') || name.includes('pet')) {
    
    if (name.includes('thermoplastic') || name.includes('polyethylene') || 
        name.includes('polypropylene') || name.includes('abs') || name.includes('asa')) {
      return {
        major: 'Polymerics',
        middle: 'Thermoplastics',
        sub: 'Engineering Plastics',
        detail: materialName
      };
    }
    
    if (name.includes('thermoset') || name.includes('epoxy') || name.includes('polyurethane')) {
      return {
        major: 'Polymerics',
        middle: 'Thermosets',
        sub: 'Epoxy Resins',
        detail: materialName
      };
    }
    
    return {
      major: 'Polymerics',
      middle: 'Thermoplastics',
      sub: 'Engineering Plastics',
      detail: materialName
    };
  }
  
  // 기본값: 분류되지 않은 금속
  return {
    major: 'Metals',
    middle: 'Otherwise Unclassified Metals',
    sub: 'Other Metals',
    detail: materialName
  };
}

/**
 * 자재에 카테고리 정보를 추가하는 함수 (4단계)
 */
export function addCategoryToMaterial(material: MakeItFromMaterial): MakeItFromMaterial & { category: MaterialCategory } {
  const url = material.references?.[0]?.url || '';
  const category = extractCategoryFromUrl(url) || inferCategoryFromMaterialName(material.name) || {
    major: 'Metals',
    middle: 'Otherwise Unclassified Metals',
    sub: 'Other Metals',
    detail: material.name
  };
  
  return {
    ...material,
    category
  };
}

/**
 * 카테고리별로 자재를 그룹화하는 함수 (4단계)
 */
export function groupMaterialsByCategory(materials: MakeItFromMaterial[]): {
  [major: string]: {
    [middle: string]: {
      [sub: string]: {
        [detail: string]: (MakeItFromMaterial & { category: MaterialCategory })[]
      }
    }
  }
} {
  const grouped: any = {};
  
  materials.forEach(material => {
    const materialWithCategory = addCategoryToMaterial(material);
    const { major, middle, sub, detail } = materialWithCategory.category;
    
    if (!grouped[major]) grouped[major] = {};
    if (!grouped[major][middle]) grouped[major][middle] = {};
    if (!grouped[major][middle][sub]) grouped[major][middle][sub] = {};
    if (!grouped[major][middle][sub][detail]) grouped[major][middle][sub][detail] = [];
    
    grouped[major][middle][sub][detail].push(materialWithCategory);
  });
  
  return grouped;
}

/**
 * 특정 카테고리의 자재만 필터링하는 함수 (4단계)
 */
export function filterMaterialsByCategory(
  materials: MakeItFromMaterial[], 
  major?: string, 
  middle?: string, 
  sub?: string,
  detail?: string
): (MakeItFromMaterial & { category: MaterialCategory })[] {
  return materials
    .map(material => addCategoryToMaterial(material))
    .filter(material => {
      const { category } = material;
      
      if (major && category.major !== major) return false;
      if (middle && category.middle !== middle) return false;
      if (sub && category.sub !== sub) return false;
      if (detail && category.detail !== detail) return false;
      
      return true;
    });
}