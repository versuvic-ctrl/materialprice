-- 타임아웃 에러 해결을 위한 specification 컬럼 인덱스 생성
-- kpi_price_data 테이블의 specification 컬럼에 인덱스를 추가하여 
-- COUNT(DISTINCT specification) 쿼리 성능을 향상시킵니다.

CREATE INDEX IF NOT EXISTS idx_kpi_price_data_specification 
ON public.kpi_price_data (specification);

-- 추가적으로 sub_category 컬럼에도 인덱스 생성 (total categories 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_kpi_price_data_sub_category 
ON public.kpi_price_data (sub_category);

-- region 컬럼에도 인덱스 생성 (total regions 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_kpi_price_data_region 
ON public.kpi_price_data (region);

-- 복합 인덱스 생성 (카테고리별 필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_kpi_price_data_categories 
ON public.kpi_price_data (major_category, middle_category, sub_category);

-- 날짜 기반 쿼리 성능 향상을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_kpi_price_data_date 
ON public.kpi_price_data (date DESC);

-- created_at 기반 쿼리 성능 향상을 위한 인덱스 (latest updates 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_kpi_price_data_created_at 
ON public.kpi_price_data (created_at DESC);