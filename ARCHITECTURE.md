# 자재가격 대시보드 프로젝트 아키텍처

## 📋 프로젝트 개요

이 프로젝트는 한국물가정보(KPI) 사이트에서 자재 가격 데이터를 크롤링하여 
Supabase 데이터베이스에 저장하고, Next.js 기반의 웹 대시보드에서 
실시간으로 시각화하는 시스템입니다.

## 🏗️ 전체 시스템 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   KPI 웹사이트   │ -> │  Python 크롤러   │ -> │   Supabase DB   │
│  (데이터 소스)   │    │  (데이터 수집)   │    │  (데이터 저장)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        |
                                                        v
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   사용자 브라우저 │ <- │  Next.js 앱     │ <- │  Supabase 클라이언트 │
│  (UI/UX)       │    │ (프론트엔드 +    │    │  (데이터 페칭)   │
│                │    │  API Routes)    │    │                │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 프로젝트 폴더 구조

```
materials-dashboard/
├── 📁 .github/                    # GitHub Actions 워크플로우
│   └── workflows/
│       └── deploy.yml
├── 📁 backend/                    # 백엔드 API (레거시, 현재 미사용)
│   └── __pycache__/              # Python 캐시 파일만 남음
├── 📁 crawler/                    # Python 크롤링 시스템
│   ├── main.py                   # 크롤러 실행 진입점
│   ├── requirements.txt          # Python 의존성
│   ├── sites/                    # 사이트별 크롤러
│   │   ├── kpi_crawler.py       # KPI 사이트 크롤러
│   │   └── data_processor.py    # 데이터 처리 및 변환
│   └── utils/                    # 유틸리티 함수
├── 📁 lib/                       # 공통 라이브러리
├── 📁 src/                       # Next.js 소스 코드
│   ├── 📁 app/                   # App Router 구조
│   │   ├── globals.css          # 전역 스타일
│   │   ├── layout.tsx           # 루트 레이아웃
│   │   ├── page.tsx             # 홈페이지
│   │   ├── providers.tsx        # React Query Provider
│   │   ├── 📁 api/              # API 라우트
│   │   │   └── piping-materials/
│   │   │       └── route.ts     # 배관 자재 API
│   │   ├── 📁 materials/        # 자재 페이지
│   │   │   └── page.tsx
│   │   └── 📁 technical-docs/   # 기술 문서 페이지
│   │       └── page.tsx
│   ├── 📁 components/           # React 컴포넌트
│   │   ├── 📁 dashboard/        # 대시보드 컴포넌트
│   │   │   ├── DashboardMiniChart.tsx
│   │   │   └── dashboardminichart(2).md
│   │   ├── 📁 materials/        # 자재 관련 컴포넌트
│   │   │   └── MaterialsChart.tsx
│   │   └── 📁 ui/              # UI 컴포넌트
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       └── select.tsx
│   ├── 📁 data/                 # 정적 데이터
│   │   └── materials.ts
│   ├── 📁 lib/                  # 라이브러리 설정
│   │   ├── supabase.ts         # Supabase 클라이언트
│   │   └── utils.ts            # 유틸리티 함수
│   ├── 📁 store/               # 상태 관리 (Zustand)
│   │   └── materialStore.ts    # 자재 상태 스토어
│   └── 📁 types/               # TypeScript 타입 정의
│       └── materials.ts
├── 📁 supabase/                 # Supabase 설정
│   ├── config.toml
│   └── seed.sql
├── .env.local                   # 환경 변수
├── next.config.js              # Next.js 설정
├── package.json                # Node.js 의존성
├── tailwind.config.ts          # Tailwind CSS 설정
└── tsconfig.json               # TypeScript 설정
```

## 🐍 크롤링 시스템 (Python)

### 주요 파일

#### 1. `crawler/main.py`
- 크롤러 실행의 진입점
- 스케줄링 및 오류 처리
- 로깅 시스템

#### 2. `crawler/sites/kpi_crawler.py`
- KPI 사이트 전용 크롤러
- Playwright를 사용한 브라우저 자동화
- 로그인, 카테고리 탐색, 데이터 추출

```python
class KpiCrawler:
    def __init__(self):
        self.base_url = "https://www.kpi.or.kr"
        self.login_url = f"{self.base_url}/www/selectBbsNttList.do?bbsNo=438"
        
    async def run(self):
        # 브라우저 실행 -> 로그인 -> 카테고리 크롤링 -> 데이터 수집
        
    def _crawl_categories(self):
        # 대분류 -> 중분류 -> 소분류 -> 규격별 데이터 수집
```

#### 3. `crawler/sites/data_processor.py`
- 크롤링된 원본 데이터를 표준 형식으로 변환
- Pandas를 사용한 데이터 처리
- Supabase 업로드 및 중복 제거

```python
class BaseDataProcessor:
    def transform_to_standard_format(self, raw_data):
        # 사이트별 데이터를 표준 형식으로 변환
        return {
            'major_category': str,
            'middle_category': str,
            'sub_category': str,
            'specification': str,
            'unit': str,
            'region': str,
            'date': str,  # YYYY-MM-DD
            'price': int
        }
```

### 데이터 플로우

```
1. KPI 사이트 접속 및 로그인
2. 카테고리별 데이터 수집
   - 대분류 (공통자재, 건축자재 등)
   - 중분류 (봉강, 형강 등)
   - 소분류 (이형철근, 원형강관 등)
   - 규격 (D10㎜, D13㎜ 등)
3. 원본 데이터 파싱 및 정제
4. 표준 형식으로 변환
5. Supabase 데이터베이스에 저장
6. 중복 데이터 제거 및 업데이트
```

## 🗄️ 데이터베이스 (Supabase)

### 주요 테이블

#### 1. `kpi_price_data`
```sql
CREATE TABLE kpi_price_data (
    id BIGSERIAL PRIMARY KEY,
    major_category TEXT NOT NULL,     -- 대분류
    middle_category TEXT NOT NULL,    -- 중분류
    sub_category TEXT NOT NULL,       -- 소분류
    specification TEXT NOT NULL,      -- 규격
    unit TEXT NOT NULL,              -- 단위
    region TEXT NOT NULL,            -- 지역
    date DATE NOT NULL,              -- 날짜
    price INTEGER,                   -- 가격
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. `technical_articles` (기술 문서)
```sql
CREATE TABLE technical_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 데이터 연동

```python
# Python 크롤러에서 Supabase 연동
from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# 데이터 삽입
result = supabase.table('kpi_price_data').insert({
    'major_category': '공통자재',
    'middle_category': '봉강',
    'sub_category': '이형철근',
    'specification': 'D10㎜',
    'price': 850000
}).execute()
```

## ⚛️ 프론트엔드 (Next.js + React)

### 기술 스택

- **Next.js 14**: App Router, Server Components
- **React 18**: 함수형 컴포넌트, Hooks
- **TypeScript**: 타입 안정성
- **Tailwind CSS**: 스타일링
- **Zustand**: 상태 관리
- **React Query**: 서버 상태 관리
- **Recharts**: 차트 라이브러리
- **Supabase**: 데이터베이스 클라이언트

### 주요 컴포넌트

#### 1. `src/app/providers.tsx`
```tsx
// React Query 및 전역 상태 제공자
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5분
        cacheTime: 1000 * 60 * 30, // 30분
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

#### 2. `src/store/materialStore.ts` (Zustand)
```tsx
// 자재 선택 및 차트 설정 상태 관리
interface MaterialState {
  selectedLevel1: string;        // 대분류
  selectedLevel2: string;        // 중분류
  selectedLevel3: string;        // 소분류
  selectedLevel4: string;        // 규격
  interval: 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
  selectedMaterialsForChart: string[];
}
```

#### 3. `src/components/materials/MaterialsChart.tsx`
```tsx
// React Query로 데이터 페칭
const { data: rawData, isLoading, isError } = useQuery({
  queryKey: ['materials', selectedLevel1, selectedLevel2, selectedLevel3],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('kpi_price_data')
      .select('*')
      .eq('major_category', selectedLevel1)
      .eq('middle_category', selectedLevel2)
      .eq('sub_category', selectedLevel3);
    
    if (error) throw error;
    return data;
  },
  enabled: !!(selectedLevel1 && selectedLevel2 && selectedLevel3)
});
```

### 데이터 플로우

```
1. 사용자가 카테고리 선택 (Zustand 상태 업데이트)
2. React Query가 상태 변화 감지
3. Supabase에서 해당 카테고리 데이터 조회
4. 데이터 캐싱 및 UI 업데이트
5. Recharts로 차트 렌더링
```

## 🔄 전체 데이터 플로우

### 1. 데이터 수집 단계
```
KPI 웹사이트 -> Python 크롤러 -> 데이터 정제 -> Supabase 저장
```

### 2. 데이터 조회 단계
```
사용자 요청 -> React Query -> Supabase 조회 -> 캐싱 -> UI 렌더링
```

### 3. 실시간 업데이트
```
크롤러 스케줄 실행 -> 새 데이터 수집 -> DB 업데이트 -> 
프론트엔드 자동 갱신 (React Query 무효화)
```

## 🚀 배포 및 운영

### 환경 변수 설정

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 크롤러 실행

```bash
# Python 환경 설정
cd crawler
pip install -r requirements.txt

# 크롤러 실행
python main.py
```

### 프론트엔드 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
# http://localhost:3000

# 프로덕션 빌드
npm run build
npm start
```

## 🔧 주요 기능

### 1. 자재 가격 크롤링
- 한국물가정보(KPI) 사이트 자동 크롤링
- 카테고리별 체계적 데이터 수집
- 중복 제거 및 데이터 정제

### 2. 실시간 대시보드
- 자재별 가격 추이 차트
- 카테고리별 필터링
- 기간별 데이터 조회

### 3. 데이터 관리
- Supabase를 통한 안정적인 데이터 저장
- React Query를 통한 효율적인 캐싱
- 실시간 데이터 동기화

## 📈 확장 가능성

### 1. 추가 데이터 소스
- 다른 자재 가격 사이트 크롤링
- API 연동을 통한 실시간 데이터 수집

### 2. 고급 분석 기능
- 가격 예측 모델
- 시장 동향 분석
- 알림 시스템

### 3. 사용자 기능
- 사용자 인증 및 권한 관리
- 개인화된 대시보드
- 데이터 내보내기

## 🛠️ 기술적 고려사항

### 성능 최적화
- React Query를 통한 데이터 캐싱
- Next.js Server Components 활용
- 이미지 및 번들 최적화

### 보안
- 환경 변수를 통한 민감 정보 관리
- Supabase RLS(Row Level Security) 적용
- CORS 및 API 보안 설정

### 모니터링
- 크롤러 실행 로그 관리
- 에러 추적 및 알림
- 성능 모니터링

---

이 아키텍처는 확장 가능하고 유지보수가 용이한 구조로 설계되어 
향후 기능 추가 및 개선이 용이합니다.