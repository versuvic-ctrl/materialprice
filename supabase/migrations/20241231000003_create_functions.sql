-- 조회수 증가 함수 생성
CREATE OR REPLACE FUNCTION increment_view_count(doc_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE technical_docs 
  SET view_count = view_count + 1,
      updated_at = NOW()
  WHERE id = doc_id;
END;
$$;

-- 문서 검색을 위한 전체 텍스트 검색 함수
CREATE OR REPLACE FUNCTION search_technical_docs(
  search_query TEXT DEFAULT '',
  category_filter UUID DEFAULT NULL,
  status_filter TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content_html TEXT,
  category_id UUID,
  author TEXT,
  status TEXT,
  tags TEXT[],
  meta_description TEXT,
  view_count INTEGER,
  is_featured BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  category_name TEXT,
  category_color TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    td.id,
    td.title,
    td.content_html,
    td.category_id,
    td.author,
    td.status,
    td.tags,
    td.meta_description,
    td.view_count,
    td.is_featured,
    td.created_at,
    td.updated_at,
    tdc.name as category_name,
    tdc.color as category_color
  FROM technical_docs td
  LEFT JOIN technical_doc_categories tdc ON td.category_id = tdc.id
  WHERE 
    (search_query = '' OR 
     td.title ILIKE '%' || search_query || '%' OR 
     td.content_html ILIKE '%' || search_query || '%' OR
     td.meta_description ILIKE '%' || search_query || '%')
    AND (category_filter IS NULL OR td.category_id = category_filter)
    AND (status_filter IS NULL OR td.status = status_filter)
  ORDER BY td.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- 문서 통계 조회 함수
CREATE OR REPLACE FUNCTION get_docs_stats()
RETURNS TABLE (
  total_docs BIGINT,
  published_docs BIGINT,
  draft_docs BIGINT,
  archived_docs BIGINT,
  total_views BIGINT,
  categories_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_docs,
    COUNT(*) FILTER (WHERE status = 'published') as published_docs,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_docs,
    COUNT(*) FILTER (WHERE status = 'archived') as archived_docs,
    COALESCE(SUM(view_count), 0) as total_views,
    (SELECT COUNT(*) FROM technical_doc_categories) as categories_count
  FROM technical_docs;
END;
$$;

-- 카테고리별 문서 수 조회 함수
CREATE OR REPLACE FUNCTION get_category_doc_counts()
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  doc_count BIGINT,
  published_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tdc.id as category_id,
    tdc.name as category_name,
    COUNT(td.id) as doc_count,
    COUNT(td.id) FILTER (WHERE td.status = 'published') as published_count
  FROM technical_doc_categories tdc
  LEFT JOIN technical_docs td ON tdc.id = td.category_id
  GROUP BY tdc.id, tdc.name
  ORDER BY tdc.name;
END;
$$;

-- 인기 태그 조회 함수
CREATE OR REPLACE FUNCTION get_popular_tags(tag_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  tag TEXT,
  usage_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    unnest(tags) as tag,
    COUNT(*) as usage_count
  FROM technical_docs
  WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
  GROUP BY unnest(tags)
  ORDER BY usage_count DESC, tag ASC
  LIMIT tag_limit;
END;
$$;