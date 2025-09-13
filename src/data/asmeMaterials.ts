// ASME 정식 자재명 데이터
export interface ASMEMaterial {
  code: string;
  name: string;
  category: string;
  description?: string;
}

export const asmeMaterials: ASMEMaterial[] = [
  // 탄소강 (Carbon Steel)
  {
    code: "SA-36",
    name: "Carbon Structural Steel",
    category: "Carbon Steel",
    description: "구조용 탄소강"
  },
  {
    code: "SA-106 Gr.B",
    name: "Seamless Carbon Steel Pipe",
    category: "Carbon Steel",
    description: "이음매없는 탄소강 배관"
  },
  {
    code: "SA-516 Gr.70",
    name: "Pressure Vessel Plates, Carbon Steel",
    category: "Carbon Steel",
    description: "압력용기용 탄소강 플레이트"
  },
  
  // 스테인리스강 (Stainless Steel)
  {
    code: "SA-240 TP304",
    name: "Stainless Steel Plate, Sheet, and Strip",
    category: "Stainless Steel",
    description: "스테인리스강 플레이트, 시트, 스트립"
  },
  {
    code: "SA-240 TP316L",
    name: "Stainless Steel Plate, Sheet, and Strip",
    category: "Stainless Steel",
    description: "저탄소 스테인리스강 플레이트"
  },
  {
    code: "SA-312 TP304",
    name: "Seamless and Welded Austenitic Stainless Steel Pipes",
    category: "Stainless Steel",
    description: "오스테나이트계 스테인리스강 배관"
  },
  {
    code: "SA-312 TP316L",
    name: "Seamless and Welded Austenitic Stainless Steel Pipes",
    category: "Stainless Steel",
    description: "저탄소 오스테나이트계 스테인리스강 배관"
  },
  
  // 합금강 (Alloy Steel)
  {
    code: "SA-335 P11",
    name: "Seamless Ferritic Alloy-Steel Pipe",
    category: "Alloy Steel",
    description: "이음매없는 페라이트계 합금강 배관"
  },
  {
    code: "SA-335 P22",
    name: "Seamless Ferritic Alloy-Steel Pipe",
    category: "Alloy Steel",
    description: "이음매없는 페라이트계 합금강 배관"
  },
  {
    code: "SA-387 Gr.11",
    name: "Pressure Vessel Plates, Alloy Steel, Chromium-Molybdenum",
    category: "Alloy Steel",
    description: "크롬-몰리브덴 합금강 압력용기 플레이트"
  },
  
  // 단조품 (Forgings)
  {
    code: "SA-105",
    name: "Carbon Steel Forgings for Piping Applications",
    category: "Forgings",
    description: "배관용 탄소강 단조품"
  },
  {
    code: "SA-182 F304",
    name: "Forged or Rolled Alloy and Stainless Steel Pipe Flanges",
    category: "Forgings",
    description: "스테인리스강 단조 플랜지"
  },
  {
    code: "SA-182 F316L",
    name: "Forged or Rolled Alloy and Stainless Steel Pipe Flanges",
    category: "Forgings",
    description: "저탄소 스테인리스강 단조 플랜지"
  },
  
  // 주조품 (Castings)
  {
    code: "SA-216 WCB",
    name: "Steel Castings, Carbon, Suitable for Fusion Welding",
    category: "Castings",
    description: "용접 가능한 탄소강 주조품"
  },
  {
    code: "SA-351 CF8",
    name: "Castings, Austenitic, for Pressure-Containing Parts",
    category: "Castings",
    description: "압력부품용 오스테나이트계 주조품"
  },
  {
    code: "SA-351 CF8M",
    name: "Castings, Austenitic, for Pressure-Containing Parts",
    category: "Castings",
    description: "몰리브덴 함유 오스테나이트계 주조품"
  },
  
  // 볼트 재료 (Bolting Materials)
  {
    code: "SA-193 B7",
    name: "Alloy-Steel and Stainless Steel Bolting Materials",
    category: "Bolting",
    description: "합금강 볼트 재료"
  },
  {
    code: "SA-193 B8",
    name: "Alloy-Steel and Stainless Steel Bolting Materials",
    category: "Bolting",
    description: "스테인리스강 볼트 재료"
  },
  {
    code: "SA-194 2H",
    name: "Carbon and Alloy Steel Nuts",
    category: "Bolting",
    description: "탄소강 및 합금강 너트"
  },
  
  // 비철금속 (Non-Ferrous)
  {
    code: "SB-111 C70600",
    name: "Copper and Copper-Alloy Seamless Condenser and Heat Exchanger Tubes",
    category: "Non-Ferrous",
    description: "구리-니켈 합금 열교환기 튜브"
  },
  {
    code: "SB-127 N06625",
    name: "Nickel-Chromium-Molybdenum-Columbium Alloy Plate, Sheet, and Strip",
    category: "Non-Ferrous",
    description: "인코넬 625 플레이트"
  }
];

// 카테고리별 그룹화
export const materialCategories = [
  "Carbon Steel",
  "Stainless Steel", 
  "Alloy Steel",
  "Forgings",
  "Castings",
  "Bolting",
  "Non-Ferrous"
];

// 카테고리별 자재 필터링 함수
export const getMaterialsByCategory = (category: string): ASMEMaterial[] => {
  return asmeMaterials.filter(material => material.category === category);
};

// 자재 검색 함수
export const searchMaterials = (query: string): ASMEMaterial[] => {
  const lowercaseQuery = query.toLowerCase();
  return asmeMaterials.filter(material => 
    material.code.toLowerCase().includes(lowercaseQuery) ||
    material.name.toLowerCase().includes(lowercaseQuery) ||
    material.description?.toLowerCase().includes(lowercaseQuery)
  );
};