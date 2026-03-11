-- 누락된 RPC 함수들 생성
-- get_material_prices 함수 생성

CREATE OR REPLACE FUNCTION public.get_material_prices(
    material_names text[],
    start_date_str text,
    end_date_str text,
    time_interval text
)
RETURNS TABLE(
    specification text,
    region text,
    date date,
    price integer,
    major_category text,
    middle_category text,
    sub_category text,
    unit text
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kpd.specification,
        kpd.region,
        kpd.date,
        kpd.price,
        kpd.major_category,
        kpd.middle_category,
        kpd.sub_category,
        kpd.unit
    FROM public.kpi_price_data kpd
    WHERE 
        kpd.specification = ANY(material_names)
        AND kpd.date >= start_date_str::date
        AND kpd.date <= end_date_str::date
        AND kpd.price IS NOT NULL
    ORDER BY kpd.date DESC, kpd.specification, kpd.region;
END;
$$;

-- get_distinct_categories 함수 생성
CREATE OR REPLACE FUNCTION public.get_distinct_categories(
    level_param integer,
    filters jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
    category_name text,
    count bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- level 1: major_category
    IF level_param = 1 THEN
        RETURN QUERY
        SELECT 
            kpd.major_category as category_name,
            COUNT(*) as count
        FROM public.kpi_price_data kpd
        GROUP BY kpd.major_category
        ORDER BY kpd.major_category;
    
    -- level 2: middle_category
    ELSIF level_param = 2 THEN
        RETURN QUERY
        SELECT 
            kpd.middle_category as category_name,
            COUNT(*) as count
        FROM public.kpi_price_data kpd
        WHERE (filters->>'major_category' IS NULL OR kpd.major_category = filters->>'major_category')
        GROUP BY kpd.middle_category
        ORDER BY kpd.middle_category;
    
    -- level 3: sub_category
    ELSIF level_param = 3 THEN
        RETURN QUERY
        SELECT 
            kpd.sub_category as category_name,
            COUNT(*) as count
        FROM public.kpi_price_data kpd
        WHERE 
            (filters->>'major_category' IS NULL OR kpd.major_category = filters->>'major_category')
            AND (filters->>'middle_category' IS NULL OR kpd.middle_category = filters->>'middle_category')
        GROUP BY kpd.sub_category
        ORDER BY kpd.sub_category;
    
    -- level 4: specification
    ELSIF level_param = 4 THEN
        RETURN QUERY
        SELECT 
            kpd.specification as category_name,
            COUNT(*) as count
        FROM public.kpi_price_data kpd
        WHERE 
            (filters->>'major_category' IS NULL OR kpd.major_category = filters->>'major_category')
            AND (filters->>'middle_category' IS NULL OR kpd.middle_category = filters->>'middle_category')
            AND (filters->>'sub_category' IS NULL OR kpd.sub_category = filters->>'sub_category')
        GROUP BY kpd.specification
        ORDER BY kpd.specification;
    
    END IF;
END;
$$;

-- 권한 설정
GRANT EXECUTE ON FUNCTION public.get_material_prices(text[], text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_categories(integer, jsonb) TO anon, authenticated;

-- 함수 설명 추가
COMMENT ON FUNCTION public.get_material_prices(text[], text, text, text) IS 
'자재 가격 데이터를 조회하는 함수. 자재명 배열, 시작일, 종료일, 시간 간격을 받아 해당 기간의 가격 데이터를 반환합니다.';

COMMENT ON FUNCTION public.get_distinct_categories(integer, jsonb) IS 
'카테고리별 고유값을 조회하는 함수. 레벨(1-4)과 필터 조건을 받아 해당 레벨의 카테고리와 개수를 반환합니다.';
