// 재료 설명을 한국어로 번역하는 유틸리티 함수

// 일반적인 재료 용어 번역 매핑
const materialTermTranslations: { [key: string]: string } = {
  // 재료 유형
  'aluminum': '알루미늄',
  'steel': '강철',
  'stainless steel': '스테인리스강',
  'austenitic stainless steel': '오스테나이트계 스테인리스강',
  'carbon steel': '탄소강',
  'alloy steel': '합금강',
  'cast iron': '주철',
  'wrought': '압연',
  'cast': '주조',
  'forged': '단조',
  
  // 물성 관련
  'tensile strength': '인장강도',
  'yield strength': '항복강도',
  'hardness': '경도',
  'ductility': '연성',
  'elasticity': '탄성',
  'modulus': '계수',
  'density': '밀도',
  'thermal conductivity': '열전도도',
  'electrical conductivity': '전기전도도',
  'corrosion resistance': '내식성',
  'oxidation resistance': '내산화성',
  'fatigue resistance': '피로저항',
  
  // 원소
  'manganese': '망간',
  'silicon': '실리콘',
  'carbon': '탄소',
  'chromium': '크롬',
  'nickel': '니켈',
  'molybdenum': '몰리브덴',
  'vanadium': '바나듐',
  'titanium': '티타늄',
  'copper': '구리',
  'iron': '철',
  'zinc': '아연',
  'magnesium': '마그네슘',
  'bismuth': '비스무트',
  
  // 처리 상태
  'heat treated': '열처리된',
  'annealed': '어닐링된',
  'tempered': '템퍼링된',
  'quenched': '급냉된',
  'normalized': '정규화된',
  'cold worked': '냉간가공된',
  'hot worked': '열간가공된',
  
  // 용도/특성
  'formulated for': '~용으로 제조된',
  'primary forming': '1차 성형',
  'casting': '주조',
  'machining': '기계가공',
  'welding': '용접',
  'elevated temperatures': '고온',
  'high temperature': '고온',
  'low temperature': '저온',
  'cryogenic': '극저온',
  
  // 표준/규격
  'designation': '규격명',
  'standard': '표준',
  'specification': '사양',
  'grade': '등급',
  'condition': '상태',
  
  // 기타
  'composition': '조성',
  'content': '함량',
  'impurity': '불순물',
  'addition': '첨가',
  'improve': '개선',
  'increase': '증가',
  'decrease': '감소',
  'enhance': '향상',
  'reduce': '감소',
  'permit': '허용',
  'notable': '주목할만한',
  'comparatively': '비교적',
  'typically': '일반적으로',
  'primarily': '주로',
  'particularly': '특히',
  'additionally': '추가로',
  'furthermore': '또한',
  'however': '그러나',
  'therefore': '따라서',
  'among': '~중에서',
  'within': '~내에서',
  'appropriate': '적절한',
  'suitable': '적합한',
  'effective': '효과적인',
  'significant': '상당한',
  'considerable': '상당한',
  'substantial': '상당한'
};

// 복합 표현 번역 매핑
const phraseTranslations: { [key: string]: string } = {
  'is formulated for primary forming into wrought products': '압연 제품의 1차 성형용으로 제조됩니다',
  'is considered commercially pure': '상업적으로 순수한 것으로 간주됩니다',
  'formulated for casting': '주조용으로 제조됩니다',
  'heat treated condition': '열처리 상태',
  'cited properties are appropriate for': '인용된 물성은 ~에 적합합니다',
  'originally received its standard designation': '원래 표준 규격명을 받았습니다',
  'well established': '잘 확립된',
  'can have the lowest': '가장 낮은 ~을 가질 수 있습니다',
  'can have the highest': '가장 높은 ~을 가질 수 있습니다',
  'notable for including': '~을 포함하는 것으로 주목됩니다',
  'notable for containing': '~을 함유하는 것으로 주목됩니다',
  'used to improve': '~을 개선하기 위해 사용됩니다',
  'used to increase': '~을 증가시키기 위해 사용됩니다',
  'used to reduce': '~을 감소시키기 위해 사용됩니다',
  'permits a higher': '더 높은 ~을 허용합니다',
  'at elevated temperatures': '고온에서',
  'at high temperatures': '고온에서',
  'at room temperature': '상온에서',
  'without much impact on': '~에 큰 영향을 주지 않으면서',
  'at the expense of': '~을 희생하면서',
  'governed by': '~에 의해 좌우됩니다',
  'for the purpose of': '~을 목적으로',
  'in addition': '또한',
  'furthermore': '또한',
  'additionally': '추가로',
  'however': '그러나',
  'therefore': '따라서',
  'among': '~중에서'
};

/**
 * 재료 설명을 한국어로 번역하는 함수
 * @param description 영어 설명
 * @returns 한국어로 번역된 설명
 */
export function translateDescription(description: string): string {
  if (!description) return '';
  
  let translated = description.toLowerCase();
  
  // 복합 표현 먼저 번역
  Object.entries(phraseTranslations).forEach(([english, korean]) => {
    const regex = new RegExp(english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    translated = translated.replace(regex, korean);
  });
  
  // 개별 용어 번역
  Object.entries(materialTermTranslations).forEach(([english, korean]) => {
    // 단어 경계를 고려한 정확한 매칭
    const regex = new RegExp(`\\b${english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    translated = translated.replace(regex, korean);
  });
  
  // 첫 글자 대문자로 변환
  translated = translated.charAt(0).toUpperCase() + translated.slice(1);
  
  return translated;
}

/**
 * 재료 설명을 간단하고 자연스러운 한국어 요약으로 변환하는 함수
 * @param description 영어 설명
 * @returns 한국어 요약
 */
export function getKoreanSummary(description: string): string {
  if (!description) return '';
  
  const lower = description.toLowerCase();
  
  // 재료 유형 식별
  const materialType = identifyMaterialType(lower);
  
  // 주요 특징 추출
  const features = extractKeyFeatures(lower);
  
  // 용도 추출
  const applications = extractApplications(lower);
  
  // 요약 생성
  let summary = materialType;
  
  if (applications.length > 0) {
    summary += ` - ${applications.join(', ')}`;
  } else if (features.length > 0) {
    summary += ` - ${features.slice(0, 2).join(', ')}`; // 최대 2개 특징만
  }
  
  return summary;
}

/**
 * 설명에서 재료 유형을 식별하는 함수
 */
function identifyMaterialType(description: string): string {
  // 스테인리스강 세부 분류
  if (description.includes('austenitic stainless steel')) return '오스테나이트계 스테인리스강';
  if (description.includes('ferritic stainless steel')) return '페라이트계 스테인리스강';
  if (description.includes('martensitic stainless steel')) return '마르텐사이트계 스테인리스강';
  if (description.includes('duplex stainless steel')) return '듀플렉스 스테인리스강';
  if (description.includes('stainless steel')) return '스테인리스강';
  
  // 강철 분류
  if (description.includes('carbon steel')) return '탄소강';
  if (description.includes('alloy steel')) return '합금강';
  if (description.includes('tool steel')) return '공구강';
  if (description.includes('spring steel')) return '스프링강';
  if (description.includes('steel')) return '강철';
  
  // 주철
  if (description.includes('cast iron')) return '주철';
  if (description.includes('ductile iron')) return '구상흑연주철';
  if (description.includes('gray iron')) return '회주철';
  
  // 알루미늄
  if (description.includes('aluminum') && description.includes('alloy')) return '알루미늄 합금';
  if (description.includes('aluminum')) return '알루미늄';
  
  // 구리
  if (description.includes('copper') && description.includes('alloy')) return '구리 합금';
  if (description.includes('brass')) return '황동';
  if (description.includes('bronze')) return '청동';
  if (description.includes('copper')) return '구리';
  
  // 티타늄
  if (description.includes('titanium') && description.includes('alloy')) return '티타늄 합금';
  if (description.includes('titanium')) return '티타늄';
  
  // 니켈
  if (description.includes('nickel') && description.includes('alloy')) return '니켈 합금';
  if (description.includes('nickel')) return '니켈';
  
  return '금속 재료';
}

/**
 * 설명에서 용도를 추출하는 함수
 */
function extractApplications(description: string): string[] {
  const applications: string[] = [];
  
  if (description.includes('formulated for primary forming') || description.includes('wrought products')) {
    applications.push('단조·압연 가공재');
  }
  if (description.includes('casting') || description.includes('formulated for casting')) {
    applications.push('주조용');
  }
  if (description.includes('machining') || description.includes('machinable')) {
    applications.push('기계가공용');
  }
  if (description.includes('welding') || description.includes('weldable')) {
    applications.push('용접용');
  }
  if (description.includes('high temperature') || description.includes('elevated temperature')) {
    applications.push('고온용');
  }
  if (description.includes('low temperature') || description.includes('cryogenic')) {
    applications.push('저온용');
  }
  if (description.includes('structural')) {
    applications.push('구조용');
  }
  if (description.includes('automotive')) {
    applications.push('자동차용');
  }
  if (description.includes('aerospace')) {
    applications.push('항공우주용');
  }
  if (description.includes('marine') || description.includes('seawater')) {
    applications.push('해양용');
  }
  if (description.includes('chemical') || description.includes('corrosive')) {
    applications.push('화학용');
  }
  
  return applications;
}

/**
 * 설명에서 주요 특징을 추출하는 함수
 */
function extractKeyFeatures(description: string): string[] {
  const features: string[] = [];
  
  if (description.includes('high strength') || description.includes('high tensile')) {
    features.push('고강도');
  }
  if (description.includes('low cost') || description.includes('very low base cost')) {
    features.push('경제적');
  }
  if (description.includes('corrosion resistance') || description.includes('corrosion resistant')) {
    features.push('내식성 우수');
  }
  if (description.includes('good ductility') || description.includes('improve ductility')) {
    features.push('연성 우수');
  }
  if (description.includes('lightweight') || description.includes('low density')) {
    features.push('경량');
  }
  if (description.includes('high conductivity') || description.includes('electrical conductivity')) {
    features.push('전기전도성 우수');
  }
  if (description.includes('thermal conductivity')) {
    features.push('열전도성 우수');
  }
  if (description.includes('wear resistance') || description.includes('wear resistant')) {
    features.push('내마모성');
  }
  if (description.includes('fatigue resistance') || description.includes('fatigue')) {
    features.push('피로저항성');
  }
  if (description.includes('oxidation resistance')) {
    features.push('내산화성');
  }
  
  return features;
}