# 건설자재 가격 대시보드 - 핵심 아키텍처 요약

## 🏗️ 프로젝트 개요
- **목적**: 건설자재 가격 정보 수집, 저장, 시각화 대시보드
- **기술 스택**: Next.js 15 + TypeScript + Supabase + Redis + Python
- **배포**: Vercel (프론트엔드) + GitHub Actions (자동화)

## 📁 프로젝트 구조 및 파일 역할

```
materials-dashboard/
├── 📂 .github/workflows/
│   └── crawler.yml                    # GitHub Actions 자동 크롤링 스케줄러
├── 📂 backend/                        # 레거시 FastAPI 백엔드 (현재 미사용)
│   └── __pycache__/                   # Python 캐시 파일만 남음
├── 📂 crawler/                        # 데이터 수집 시스템
│   └── sites/
│       ├── kpi_crawler.py            # KPI 사이트 크롤러 (Selenium)
│       └── data_processor.py         # 데이터 처리 및 DB 저장 (pandas)
├── 📂 src/                           # Next.js 프론트엔드
│   ├── app/                          # App Router 페이지들
│   │   ├── page.tsx                  # 메인 대시보드
│   │   ├── providers.tsx             # React Query 전역 설정
│   │   └── iso-piping-editor/        # ISO 배관도 에디터
│   ├── components/                   # 재사용 컴포넌트
│   │   ├── dashboard/                # 대시보드 차트 컴포넌트
│   │   ├── materials/                # 자재 선택/차트 컴포넌트
│   │   └── ui/                       # shadcn/ui 기본 컴포넌트
│   ├── store/
│   │   └── materialStore.ts          # Zustand 전역 상태 관리
│   └── lib/
│       ├── supabase.ts               # Supabase 클라이언트 설정
│       └── api.ts                    # API 호출 함수들
├── 📂 supabase/                      # Supabase 설정
│   ├── migrations/                   # 데이터베이스 스키마 변경
│   └── config.toml                   # Supabase 로컬 설정
├── .env.local                        # 환경변수 (API 키, DB 연결 정보)
├── package.json                      # 프론트엔드 의존성
└── requirements.txt                  # Python 의존성
```

## 🔧 핵심 기능 및 아키텍처

### 1. 📊 데이터 수집 시스템 (Python + Selenium)
**파일**: `crawler/sites/kpi_crawler.py`, `data_processor.py`

- **크롤링**: Selenium으로 KPI 사이트에서 건설자재 가격 데이터 수집
- **데이터 처리**: pandas로 데이터 정제, 변환, 검증
- **중복 제거**: 기존 데이터와 비교하여 신규 데이터만 저장
- **자동화**: GitHub Actions로 매일 자동 실행

```python
# data_processor.py 핵심 로직
def process_and_save_data(self, data_list, major_category, middle_category, sub_category, specification):
    # pandas DataFrame으로 변환
    df = pd.DataFrame(data_list)
    
    # 기존 데이터 확인 (Redis 캐시 우선)
    existing_data = self.check_existing_data(...)
    
    # 신규 데이터만 필터링
    new_data = df[~df.apply(lambda row: tuple(row) in existing_data, axis=1)]
    
    # Supabase에 저장
    if not new_data.empty:
        supabase.table('kpi_price_data').insert(new_data.to_dict('records')).execute()
```

### 2. ⚡ Redis 캐싱 시스템 (24시간 TTL)
**설정**: `.env.local` - `REDIS_URL=rediss://...upstash.io:6380`

- **목적**: Supabase API 호출 제한 (5만회/월) 해결
- **캐시 키**: `existing_data:{table}:{major}:{middle}:{sub}:{spec}`
- **TTL**: 86400초 (24시간)
- **작동 방식**:
  1. 데이터 조회 시 Redis 캐시 먼저 확인 (Cache HIT)
  2. 캐시 없으면 Supabase 조회 후 Redis에 저장 (Cache MISS)
  3. 24시간 후 자동 만료

```python
# Redis 캐싱 로직
def check_existing_data(self, ...):
    cache_key = f"existing_data:{table_name}:{major_category}:..."
    
    # 1. Redis 캐시 확인
    if redis_client:
        cached_data = redis_client.get(cache_key)
        if cached_data:
            return json.loads(cached_data)  # Cache HIT
    
    # 2. Supabase 조회
    response = supabase.table(table_name).select(...).execute()
    
    # 3. Redis에 24시간 캐싱
    redis_client.set(cache_key, json.dumps(data), ex=86400)
```

**⚠️ Redis 연결 상태**: 현재 Timeout 오류 발생 - Upstash Redis 서비스 확인 필요

### 3. 🎯 Zustand 상태 관리
**파일**: `src/store/materialStore.ts`

- **전역 상태**: 자재 선택, 날짜 범위, 차트 설정 관리
- **계층적 선택**: 대분류 → 중분류 → 소분류 → 규격 (4단계)
- **차트 관리**: 선택된 자재들의 표시/숨김 상태 관리

```typescript
interface MaterialState {
  // 자재 선택 상태
  selectedLevel1: string;  // 대분류 (예: 공통자재)
  selectedLevel2: string;  // 중분류 (예: 봉강)
  selectedLevel3: string;  // 소분류 (예: 스파이럴철근)
  selectedLevel4: string;  // 규격 (예: D10)
  
  // 차트 설정
  selectedMaterialsForChart: string[];  // 차트에 표시할 자재들
  hiddenMaterials: Set<string>;         // 숨겨진 자재들
  
  // 날짜/기간 설정
  interval: 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
}
```

### 4. 🤖 GitHub Actions 자동화
**파일**: `.github/workflows/crawler.yml`

- **스케줄**: 매일 오전 9시 (KST) 자동 실행
- **트리거**: 수동 실행 (workflow_dispatch) 지원
- **환경**: Ubuntu 최신 + Python 3.9 + Chrome
- **보안**: GitHub Secrets로 민감 정보 관리

```yaml
name: Daily Material Price Crawler
on:
  schedule:
    - cron: '0 0 * * *'  # 매일 UTC 00:00 (KST 09:00)
  workflow_dispatch:     # 수동 실행 가능

jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run crawler
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
          REDIS_URL: ${{ secrets.REDIS_URL }}
        run: python crawler/sites/kpi_crawler.py
```

### 5. 🗄️ 데이터베이스 구조 (Supabase PostgreSQL)

**주요 테이블**:
- `kpi_price_data`: 자재 가격 데이터
  - `major_category`, `middle_category`, `sub_category`, `specification`
  - `date`, `region`, `price`
  - `created_at`, `updated_at`

**RPC 함수**:
- `get_price_data()`: 필터링된 가격 데이터 조회
- `get_categories()`: 카테고리 계층 구조 조회

### 6. 📈 프론트엔드 아키텍처 (Next.js 15)

**핵심 컴포넌트**:
- `MaterialsChart.tsx`: Recharts 기반 가격 차트
- `DashboardMiniChart.tsx`: 대시보드 미니 차트
- `MaterialSelector.tsx`: 4단계 자재 선택기

**상태 관리 흐름**:
1. Zustand Store에서 선택 상태 관리
2. React Query로 서버 데이터 캐싱
3. Recharts로 실시간 차트 렌더링

## 🚀 데이터 흐름

```
1. GitHub Actions (매일 09:00)
   ↓
2. Python Crawler (Selenium)
   ↓
3. 데이터 처리 (pandas)
   ↓
4. Redis 캐시 확인 (24시간 TTL)
   ↓
5. Supabase 저장/조회
   ↓
6. Next.js 대시보드 (React Query + Zustand)
   ↓
7. 사용자 차트 시각화 (Recharts)
```

## ⚠️ 현재 이슈 및 해결 방안

### 1. Redis 연결 문제
- **문제**: Upstash Redis 연결 타임아웃
- **영향**: 캐싱 기능 비활성화, Supabase API 호출 증가
- **해결**: Upstash 대시보드에서 Redis 인스턴스 상태 확인 필요

### 2. API 호출 최적화
- **현재**: Redis 캐싱으로 24시간 동안 중복 조회 방지
- **효과**: Supabase 무료 플랜 5만회/월 제한 내 운영 가능

## 🎯 주요 특징

1. **완전 자동화**: 데이터 수집부터 시각화까지 무인 운영
2. **실시간 대시보드**: 최신 건설자재 가격 정보 제공
3. **확장 가능**: 새로운 자재 카테고리 쉽게 추가 가능
4. **비용 효율**: 무료 서비스 조합으로 운영비 최소화
5. **사용자 친화**: 직관적인 4단계 자재 선택 시스템