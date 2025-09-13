# 자재 가격 동향 분석 시스템 프로젝트 개요

## 📋 프로젝트 목표

### 주요 목적
- **자재 가격 동향 실시간 모니터링**: KPI 웹사이트에서 자재 가격 데이터를 자동으로 수집하여 실시간 동향 분석
- **시계열 데이터 시각화**: 자재별, 카테고리별 가격 변동을 직관적인 차트와 그래프로 표현
- **가격 예측 및 분석**: 과거 데이터를 기반으로 한 가격 트렌드 분석 및 예측 기능
- **사용자 맞춤형 대시보드**: 사용자가 관심 있는 자재에 대한 개인화된 모니터링 환경 제공

### 핵심 기능
1. **실시간 자재 가격 대시보드**
   - 주요 자재 가격 현황 한눈에 보기
   - 가격 변동률 및 트렌드 표시
   - 카테고리별 가격 비교

2. **시계열 그래프 및 차트**
   - 일별/주별/월별 가격 변동 차트
   - 여러 자재 가격 비교 그래프
   - 인터랙티브 차트 (확대/축소, 필터링)

3. **자재 가격 메뉴 페이지**
   - 전체 자재 목록 및 검색 기능
   - 자재별 상세 정보 및 가격 이력
   - 카테고리별 분류 및 필터링

4. **데이터 크롤링 시스템**
   - KPI 웹사이트 자동 크롤링
   - 일정 주기별 데이터 업데이트
   - 데이터 품질 관리 및 검증

5. **기존 엔지니어링 도구 통합**
   - 엔지니어링 계산기 (탱크, NPSH, 상사법칙 등)
   - ISO 배관 에디터
   - ASME 자재 데이터베이스
   - 기술 문서 관리

## 🛠 기술 스택

### Frontend
- **Next.js 14+** (App Router)
- **React 18+** with TypeScript
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components
- **Recharts** for data visualization
- **Framer Motion** for animations

### Backend & Database
- **Supabase** (PostgreSQL)
  - Real-time subscriptions
  - Row Level Security (RLS)
  - Authentication & Authorization
- **Next.js API Routes** for server-side logic
- **Supabase Client** for database operations

### Deployment & Infrastructure
- **Vercel** for hosting and deployment
- **Vercel Edge Functions** for serverless computing
- **Vercel Cron Jobs** for scheduled tasks
- **TRAE AI** for development assistance

### Data Collection
- **Puppeteer** for web scraping
- **Cheerio** for HTML parsing
- **Node-cron** for scheduling

### Development Tools
- **TRAE AI IDE** for AI-assisted development
- **TypeScript** for type safety
- **ESLint** & **Prettier** for code quality
- **Jest** & **React Testing Library** for testing
- **Playwright** for E2E testing

---

# 📚 개발 아키텍처 상세

> 📖 **상세 개발 가이드**: [DEVELOPMENT_ARCHITECTURE.md](./DEVELOPMENT_ARCHITECTURE.md)

## 🏗️ 시스템 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                    TRAE AI IDE                             │
├─────────────────────────────────────────────────────────────┤
│                    Frontend (Next.js)                     │
├─────────────────────────────────────────────────────────────┤
│                    API Layer                               │
├─────────────────────────────────────────────────────────────┤
│                    Database (Supabase)                    │
├─────────────────────────────────────────────────────────────┤
│                    External Services                       │
└─────────────────────────────────────────────────────────────┘
```

## 📁 프로젝트 구조

### 현재 구조 (유지)
```
src/
├── app/
│   ├── page.tsx                  # 대시보드 메인
│   ├── materials/                # 자재 가격 관리
│   ├── calculator/               # 엔지니어링 계산기 (유지)
│   ├── iso-piping-editor/        # ISO 배관 에디터 (유지)
│   ├── asme-materials/           # ASME 자재 (유지)
│   ├── settings/                 # 설정 (유지)
│   └── technical-docs/           # 기술 문서 (유지)
├── components/
│   ├── layout/                   # 레이아웃 컴포넌트
│   ├── charts/                   # 차트 컴포넌트
│   └── ui/                       # shadcn/ui 컴포넌트
├── data/                         # 샘플 데이터
└── lib/                          # 유틸리티 & 설정
```

### 추가 예정 구조
```
src/
├── app/
│   ├── api/                      # API Routes
│   └── admin/                    # 관리자 페이지
├── components/
│   ├── materials/                # 자재 관련 컴포넌트
│   └── admin/                    # 관리자 컴포넌트
├── hooks/                        # Custom React Hooks
├── types/                        # TypeScript 타입 정의
└── lib/
    ├── database/                 # DB 쿼리 함수
    ├── crawler/                  # 크롤링 로직
    └── validations/              # 데이터 검증
```

## 🗄️ 데이터베이스 설계

### 핵심 테이블
1. **material_categories** - 자재 카테고리 (4계층 구조)
2. **materials** - 자재 마스터 데이터
3. **price_history** - 가격 이력 데이터
4. **crawling_logs** - 크롤링 로그
5. **user_settings** - 사용자 설정
6. **price_alerts** - 가격 알림

### 성능 최적화
- 적절한 인덱스 설정
- Row Level Security (RLS) 적용
- 실시간 구독 기능

## 🔧 TRAE AI 연동

### 개발 워크플로우
1. **AI 코드 생성**: 컴포넌트, API, 쿼리 자동 생성
2. **실시간 디버깅**: 에러 분석 및 해결 제안
3. **성능 최적화**: 코드 품질 및 성능 개선
4. **자동 테스트**: 단위/통합/E2E 테스트 생성

### TRAE AI 설정
```json
{
  "project": {
    "name": "materials-dashboard",
    "type": "nextjs",
    "framework": "react",
    "language": "typescript"
  },
  "integrations": {
    "supabase": { "enabled": true },
    "vercel": { "enabled": true }
  }
}
```

---

# 🚀 배포 및 연동 가이드

> 📖 **상세 배포 가이드**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## ☁️ 배포 환경 구성

```
┌─────────────────────────────────────────────────────────────┐
│                    TRAE AI IDE                             │
├─────────────────────────────────────────────────────────────┤
│                    Local Development                       │
├─────────────────────────────────────────────────────────────┤
│                    Version Control (Git)                  │
├─────────────────────────────────────────────────────────────┤
│                    Vercel Platform                        │
├─────────────────────────────────────────────────────────────┤
│                    Supabase Cloud                         │
├─────────────────────────────────────────────────────────────┤
│                    External Services                       │
└─────────────────────────────────────────────────────────────┘
```

## 🔗 Vercel + Supabase + TRAE AI 연동

### 1. Supabase 설정
```bash
# Supabase CLI 설치 및 설정
npm install -g supabase
supabase login
supabase init
supabase start
```

### 2. Vercel 배포
```bash
# Vercel CLI 설치 및 배포
npm install -g vercel
vercel login
vercel
```

### 3. 환경 변수 설정
```bash
# Vercel 환경 변수
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. TRAE AI 연동
- 프로젝트 설정 파일 구성
- 개발 워크플로우 자동화
- 배포 파이프라인 연동

## 📊 모니터링 및 분석

### Vercel Analytics
- 성능 모니터링
- 사용자 분석
- 에러 추적

### Supabase 모니터링
- 데이터베이스 성능
- API 사용량
- 실시간 연결 상태

## 🔄 자동화된 크롤링

### Vercel Cron Jobs
```json
{
  "crons": [
    {
      "path": "/api/crawl/daily",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### KPI 웹사이트 크롤링
- Puppeteer를 이용한 자동 데이터 수집
- 데이터 검증 및 정제
- 에러 핸들링 및 알림

---

# 📋 현재 구현 상태

## 현재 구현 상태
### ✅ 완료된 기능
- Next.js 기반 프로젝트 구조
- 반응형 레이아웃 (사이드바 + 메인 컨텐츠)
- 대시보드 페이지 (`/`)
- 자재 가격 관리 페이지 (`/materials`)
- ISO 배관 에디터 페이지 (`/iso-piping-editor`)
- 계산기 페이지 (`/calculator`)
- 기본 UI 컴포넌트 (Card, Button, Badge 등)
- 샘플 자재 데이터 및 차트

## 구현 예정 기능

### 1. 데이터베이스 설계 (Supabase)
#### 테이블 구조
```sql
-- 자재 카테고리 (4계층 구조)
CREATE TABLE material_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  parent_id INTEGER REFERENCES material_categories(id),
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 자재 마스터
CREATE TABLE materials (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  specification TEXT,
  unit VARCHAR(20) NOT NULL,
  category_id INTEGER REFERENCES material_categories(id),
  kpi_item_code VARCHAR(50), -- KPI 사이트의 품목 코드
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 가격 이력
CREATE TABLE price_history (
  id SERIAL PRIMARY KEY,
  material_id INTEGER REFERENCES materials(id),
  price DECIMAL(15,2) NOT NULL,
  price_date DATE NOT NULL,
  data_source VARCHAR(50) DEFAULT 'KPI',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(material_id, price_date)
);

-- 크롤링 로그
CREATE TABLE crawling_logs (
  id SERIAL PRIMARY KEY,
  crawl_date DATE NOT NULL,
  total_items INTEGER,
  success_items INTEGER,
  failed_items INTEGER,
  status VARCHAR(20) DEFAULT 'completed',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. 대시보드 차트 구현
#### 6개 카테고리별 차트
1. **철계열 자재**
   - A106 Gr.B 파이프
   - A105 플랜지
   - A234 WPB 엘보
   - A216 WCB 게이트밸브

2. **비철계열 자재**
   - A182 F316L 플랜지
   - 구리 파이프
   - 알루미늄 파이프
   - 황동 피팅

3. **플라스틱 & FRP 자재**
   - PVC 파이프
   - PE 파이프
   - FRP 파이프
   - PP 피팅

4. **TEFLON 자재**
   - PTFE 라이닝 파이프
   - PTFE 가스켓
   - PTFE 밸브

5. **전기 자재**
   - 전선관
   - 케이블 트레이
   - 전기 박스
   - 접지 자재

6. **토목 자재**
   - 콘크리트 파이프
   - 맨홀
   - 하수관
   - 토목 섬유

#### 차트 기능
- 시계열 라인 차트
- 기간 선택 (월간/주간/연간)
- 날짜 범위 설정
- 가격 변동률 표시
- 호버 시 상세 정보 표시

### 3. 자재 가격 페이지 고도화
#### 기능 추가
- 4계층 카테고리 드롭다운 선택기
- 선택된 자재의 상세 차트
- 가격 비교 테이블
- 가격 알림 설정
- 데이터 내보내기 (Excel, CSV)

### 4. 데이터 크롤링 시스템
#### KPI 사이트 크롤링
- 로그인 자동화
- 자재 가격 데이터 수집
- 일일 자동 업데이트
- 에러 처리 및 로깅
- 데이터 검증 및 정제

#### 크롤링 스케줄
- 매일 오전 9시 자동 실행
- 실패 시 재시도 로직
- 관리자 알림 기능

### 5. 배포 및 연동
#### Vercel 배포
- GitHub 연동 자동 배포
- 환경 변수 설정
- 도메인 연결

#### Supabase 연동
- 데이터베이스 연결
- RLS (Row Level Security) 설정
- API 키 관리

## 파일 구조 개선 사항

### 유지할 파일/폴더
```
src/
├── app/
│   ├── page.tsx (대시보드)
│   ├── materials/page.tsx (자재 가격)
│   ├── iso-piping-editor/page.tsx
│   ├── calculator/page.tsx
│   └── layout.tsx
├── components/
│   ├── layout/Layout.tsx
│   ├── ui/ (shadcn/ui 컴포넌트)
│   └── charts/ (차트 컴포넌트)
├── data/ (샘플 데이터 - 추후 API로 대체)
└── lib/
```

### 추가할 파일/폴더
```
src/
├── lib/
│   ├── supabase.ts (Supabase 클라이언트)
│   ├── database.ts (DB 쿼리 함수)
│   └── crawler.ts (크롤링 로직)
├── types/
│   ├── material.ts
│   ├── price.ts
│   └── chart.ts
├── hooks/
│   ├── useMaterials.ts
│   ├── usePriceHistory.ts
│   └── useChartData.ts
├── components/
│   ├── charts/
│   │   ├── MaterialPriceChart.tsx (기존 개선)
│   │   ├── CategoryChart.tsx
│   │   ├── PriceComparisonChart.tsx
│   │   └── ChartControls.tsx
│   └── materials/
│       ├── MaterialSelector.tsx
│       ├── CategorySelector.tsx
│       └── PriceTable.tsx
└── app/
    ├── api/
    │   ├── materials/route.ts
    │   ├── prices/route.ts
    │   └── crawl/route.ts
    └── admin/ (크롤링 관리 페이지)
```

### 제거 고려 파일
- `src/data/materialPriceData.ts` (API로 대체 후)
- 불필요한 샘플 데이터 파일들

## 개발 단계

### Phase 1: 데이터베이스 설계 및 구축
1. Supabase 프로젝트 생성
2. 테이블 스키마 생성
3. 샘플 데이터 입력
4. API 연결 테스트

### Phase 2: 차트 시스템 구현
1. 차트 컴포넌트 개발
2. 대시보드 6개 차트 구현
3. 자재 페이지 차트 구현
4. 반응형 디자인 적용

### Phase 3: 크롤링 시스템 구축
1. KPI 사이트 분석
2. 크롤링 로직 개발
3. 데이터 검증 및 저장
4. 스케줄링 구현

### Phase 4: 배포 및 최적화
1. Vercel 배포 설정
2. 환경 변수 구성
3. 성능 최적화
4. 모니터링 설정

## 주의사항
- 현재 구현된 디자인과 기능은 절대 변경하지 않음
- 기존 레이아웃 구조 유지
- 샘플 데이터는 실제 데이터로 점진적 교체
- 크롤링 시 KPI 사이트 이용약관 준수
- 개인정보 및 인증 정보 보안 관리

## 예상 일정
- **Phase 1**: 1주
- **Phase 2**: 2주
- **Phase 3**: 2주
- **Phase 4**: 1주
- **총 예상 기간**: 6주

## 성공 지표
- 일일 자동 데이터 업데이트 성공률 95% 이상
- 차트 로딩 시간 3초 이내
- 모바일 반응형 완벽 지원
- 사용자 만족도 조사 4.5/5.0 이상