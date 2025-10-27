-- 자재 통계 데이터를 별도로 관리하는 집계 테이블 생성
-- 대시보드 성능 향상을 위해 미리 계산된 통계 데이터를 저장합니다.

CREATE TABLE IF NOT EXISTS public.material_statistics (
    id BIGSERIAL PRIMARY KEY,
    stat_type VARCHAR(50) NOT NULL, -- 'total_materials', 'total_categories', 'total_regions' 등
    stat_value INTEGER NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- stat_type에 대한 인덱스 생성 (빠른 조회를 위해)
CREATE INDEX IF NOT EXISTS idx_material_statistics_stat_type 
ON public.material_statistics (stat_type);

-- 초기 통계 데이터 삽입
INSERT INTO public.material_statistics (stat_type, stat_value) 
VALUES 
    ('total_materials', (SELECT COUNT(DISTINCT specification) FROM public.kpi_price_data)),
    ('total_categories', (SELECT COUNT(DISTINCT sub_category) FROM public.kpi_price_data)),
    ('total_regions', (SELECT COUNT(DISTINCT region) FROM public.kpi_price_data))
ON CONFLICT DO NOTHING;

-- 통계 데이터 업데이트를 위한 함수 생성
CREATE OR REPLACE FUNCTION update_material_statistics()
RETURNS void AS $$
BEGIN
    -- total_materials 업데이트
    UPDATE public.material_statistics 
    SET stat_value = (SELECT COUNT(DISTINCT specification) FROM public.kpi_price_data),
        last_updated = NOW()
    WHERE stat_type = 'total_materials';
    
    -- total_categories 업데이트
    UPDATE public.material_statistics 
    SET stat_value = (SELECT COUNT(DISTINCT sub_category) FROM public.kpi_price_data),
        last_updated = NOW()
    WHERE stat_type = 'total_categories';
    
    -- total_regions 업데이트
    UPDATE public.material_statistics 
    SET stat_value = (SELECT COUNT(DISTINCT region) FROM public.kpi_price_data),
        last_updated = NOW()
    WHERE stat_type = 'total_regions';
END;
$$ LANGUAGE plpgsql;

-- 크롤링 완료 후 통계 업데이트를 위한 트리거 함수 생성
CREATE OR REPLACE FUNCTION trigger_update_statistics()
RETURNS trigger AS $$
BEGIN
    -- 새로운 데이터가 삽입될 때마다 통계 업데이트
    PERFORM update_material_statistics();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- kpi_price_data 테이블에 트리거 생성 (선택사항 - 성능에 영향을 줄 수 있음)
-- CREATE TRIGGER update_statistics_trigger
--     AFTER INSERT ON public.kpi_price_data
--     FOR EACH STATEMENT
--     EXECUTE FUNCTION trigger_update_statistics();