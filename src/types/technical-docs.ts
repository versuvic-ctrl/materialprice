/**
 * technical-docs.ts - 기술자료 블로그 타입 정의
 * 
 * 🎯 기능:
 * - 카테고리 구조 및 계층 관리
 * - 기술자료 글 데이터 모델
 * - Tiptap 에디터 관련 타입
 * - 검색 및 필터링 타입
 */

// 카테고리 구조 정의
export interface Category {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  order: number;
  parentId?: string;
  children?: Category[];
  isExpanded?: boolean;
}

// 기술자료 글 데이터 모델
export interface TechnicalArticle {
  id: string;
  title: string;
  slug: string;
  content: string; // Tiptap JSON 형태로 저장
  excerpt: string; // 요약 (자동 생성 또는 수동 입력)
  categoryId: string;
  category?: Category;
  tags: string[];
  author: string;
  status: 'draft' | 'published' | 'archived';
  featured: boolean; // 추천 글 여부
  viewCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  metaTitle?: string;
  metaDescription?: string;
}

// 카테고리별 글 통계
export interface CategoryStats {
  categoryId: string;
  articleCount: number;
  lastUpdated: string;
}

// 검색 및 필터링 옵션
export interface SearchFilters {
  query: string;
  categoryIds: string[];
  tags: string[];
  status: 'all' | 'published' | 'draft' | 'archived';
  sortBy: 'latest' | 'oldest' | 'popular' | 'updated' | 'title';
  dateRange?: {
    start: string;
    end: string;
  };
}

// 글 목록 응답 타입
export interface ArticleListResponse {
  articles: TechnicalArticle[];
  totalCount: number;
  hasMore: boolean;
  categories: Category[];
}

// Tiptap 에디터 관련 타입
export interface EditorState {
  title: string;
  categoryId: string;
  tags: string[];
  content: any; // Tiptap JSON
  excerpt: string;
  status: 'draft' | 'published';
  featured: boolean;
  metaTitle: string;
  metaDescription: string;
}

// 인증 관련 타입
export interface AuthState {
  isAuthenticated: boolean;
  sessionExpiry?: number;
}

// 카테고리 관리 타입
export interface CategoryManagement {
  categories: Category[];
  draggedCategory?: Category;
  dropTarget?: Category;
}

// 기본 카테고리 구조 정의
export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'regulations-standards',
    name: '법규 / 규격',
    nameEn: 'Regulations & Standards',
    icon: '📋',
    description: 'KS, ISO, ASME, KOSHA, API 등 규격 및 법규 정보',
    order: 1,
    children: [
      {
        id: 'domestic-law',
        name: '국내법',
        nameEn: 'Domestic Law',
        icon: '🏛️',
        description: '국내 법규 및 규정',
        order: 1,
        parentId: 'regulations-standards'
      },
      {
        id: 'international-standards',
        name: '해외규격',
        nameEn: 'International Standards',
        icon: '🌍',
        description: 'ISO, ASME, API 등 국제 표준',
        order: 2,
        parentId: 'regulations-standards'
      },
      {
        id: 'safety-standards',
        name: '안전기준',
        nameEn: 'Safety Standards',
        icon: '🛡️',
        description: 'KOSHA, 산업안전 관련 기준',
        order: 3,
        parentId: 'regulations-standards'
      },
      {
        id: 'design-codes',
        name: '설계코드',
        nameEn: 'Design Codes',
        icon: '📐',
        description: '설계 관련 코드 및 기준',
        order: 4,
        parentId: 'regulations-standards'
      },
      {
        id: 'certification',
        name: '인증제도',
        nameEn: 'Certification',
        icon: '🏆',
        description: '각종 인증 및 검사 제도',
        order: 5,
        parentId: 'regulations-standards'
      }
    ]
  },
  {
    id: 'mechanical-piping',
    name: '기계 / 배관',
    nameEn: 'Mechanical & Piping',
    icon: '⚙️',
    description: '기계설비, 배관, 용접, 재질 등 기계공학 분야',
    order: 2,
    children: [
      {
        id: 'materials',
        name: '재질(Materials)',
        nameEn: 'Materials',
        icon: '🔩',
        description: '금속재료, 비금속재료 특성 및 선정',
        order: 1,
        parentId: 'mechanical-piping'
      },
      {
        id: 'piping',
        name: '배관(Piping)',
        nameEn: 'Piping',
        icon: '🔧',
        description: '배관설계, 응력해석, 배관재료',
        order: 2,
        parentId: 'mechanical-piping'
      },
      {
        id: 'welding',
        name: '용접(Welding)',
        nameEn: 'Welding',
        icon: '⚡',
        description: '용접기술, 용접재료, 용접검사',
        order: 3,
        parentId: 'mechanical-piping'
      },
      {
        id: 'pumps-valves',
        name: '펌프/밸브',
        nameEn: 'Pumps/Valves',
        icon: '🚰',
        description: '펌프, 밸브 선정 및 운전',
        order: 4,
        parentId: 'mechanical-piping'
      },
      {
        id: 'corrosion',
        name: '내식성(Corrosion)',
        nameEn: 'Corrosion',
        icon: '🛡️',
        description: '부식방지, 내식재료, 방식기술',
        order: 5,
        parentId: 'mechanical-piping'
      },
      {
        id: 'stress-analysis',
        name: '구조해석(Stress)',
        nameEn: 'Stress Analysis',
        icon: '📊',
        description: '구조해석, 응력계산, 강도평가',
        order: 6,
        parentId: 'mechanical-piping'
      }
    ]
  },
  {
    id: 'electrical-instrumentation',
    name: '전기 / 계기',
    nameEn: 'Electrical & Instrumentation',
    icon: '⚡',
    description: '전기설비, 제어시스템, 계측기기 분야',
    order: 3,
    children: [
      {
        id: 'power-systems',
        name: '전력계통',
        nameEn: 'Power Systems',
        icon: '🔌',
        description: '전력계통, 배전설계, 보호계전',
        order: 1,
        parentId: 'electrical-instrumentation'
      },
      {
        id: 'control-systems',
        name: '제어시스템',
        nameEn: 'Control Systems',
        icon: '🎛️',
        description: 'DCS, PLC, SCADA 제어시스템',
        order: 2,
        parentId: 'electrical-instrumentation'
      },
      {
        id: 'sensors-measurement',
        name: '센서/계측',
        nameEn: 'Sensors/Measurement',
        icon: '📡',
        description: '센서, 트랜스미터, 계측기기',
        order: 3,
        parentId: 'electrical-instrumentation'
      },
      {
        id: 'facility-safety',
        name: '설비안전',
        nameEn: 'Facility Safety',
        icon: '🚨',
        description: '전기안전, 방폭설비, 접지시스템',
        order: 4,
        parentId: 'electrical-instrumentation'
      },
      {
        id: 'instrument-piping',
        name: '계장배관',
        nameEn: 'Instrument Piping',
        icon: '🔗',
        description: '계장배관, 임펄스라인, 샘플링',
        order: 5,
        parentId: 'electrical-instrumentation'
      }
    ]
  },
  {
    id: 'industry-trends',
    name: '기술동향',
    nameEn: 'Industry Trends',
    icon: '🚀',
    description: '신기술, AI/IoT, 친환경 공정, 산업 혁신 사례',
    order: 4,
    children: [
      {
        id: 'new-technology',
        name: '신기술소개',
        nameEn: 'New Technology',
        icon: '💡',
        description: '최신 기술 동향 및 혁신 사례',
        order: 1,
        parentId: 'industry-trends'
      },
      {
        id: 'industry-cases',
        name: '산업사례',
        nameEn: 'Industry Cases',
        icon: '🏭',
        description: '실제 산업 적용 사례 및 경험',
        order: 2,
        parentId: 'industry-trends'
      },
      {
        id: 'green-carbon',
        name: '친환경/탄소저감',
        nameEn: 'Green/Carbon Reduction',
        icon: '🌱',
        description: '친환경 기술, 탄소중립, 지속가능성',
        order: 3,
        parentId: 'industry-trends'
      },
      {
        id: 'automation',
        name: '자동화',
        nameEn: 'Automation',
        icon: '🤖',
        description: '공정자동화, 스마트팩토리, 디지털트윈',
        order: 4,
        parentId: 'industry-trends'
      },
      {
        id: 'ai-utilization',
        name: 'AI활용',
        nameEn: 'AI Utilization',
        icon: '🧠',
        description: 'AI/ML 기술의 엔지니어링 적용',
        order: 5,
        parentId: 'industry-trends'
      }
    ]
  }
];

// 유틸리티 함수들
export const getCategoryById = (categories: Category[], id: string): Category | undefined => {
  for (const category of categories) {
    if (category.id === id) return category;
    if (category.children) {
      const found = getCategoryById(category.children, id);
      if (found) return found;
    }
  }
  return undefined;
};

export const getAllCategories = (categories: Category[]): Category[] => {
  const result: Category[] = [];
  for (const category of categories) {
    result.push(category);
    if (category.children) {
      result.push(...getAllCategories(category.children));
    }
  }
  return result;
};

export const getCategoryPath = (categories: Category[], categoryId: string): string[] => {
  const category = getCategoryById(categories, categoryId);
  if (!category) return [];
  
  const path = [category.name];
  if (category.parentId) {
    const parentPath = getCategoryPath(categories, category.parentId);
    return [...parentPath, ...path];
  }
  return path;
};