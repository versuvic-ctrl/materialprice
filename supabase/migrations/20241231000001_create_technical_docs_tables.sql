-- 기술문서 카테고리 테이블
CREATE TABLE IF NOT EXISTS technical_doc_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6', -- 헥스 컬러 코드
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기술문서 테이블
CREATE TABLE IF NOT EXISTS technical_docs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content_html TEXT NOT NULL, -- CKEditor HTML 내용
    category_id UUID REFERENCES technical_doc_categories(id) ON DELETE SET NULL,
    author VARCHAR(100) DEFAULT 'Anonymous',
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    tags TEXT[], -- 태그 배열
    meta_description TEXT, -- SEO용 메타 설명
    view_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기술문서 첨부파일 테이블 (Storage URL 저장)
CREATE TABLE IF NOT EXISTS technical_doc_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    doc_id UUID REFERENCES technical_docs(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT, -- 바이트 단위
    file_type VARCHAR(100), -- MIME 타입
    storage_path TEXT NOT NULL, -- Supabase Storage 경로
    storage_url TEXT NOT NULL, -- 공개 URL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기술문서 이미지 테이블 (HTML 내 이미지 추적용)
CREATE TABLE IF NOT EXISTS technical_doc_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    doc_id UUID REFERENCES technical_docs(id) ON DELETE CASCADE,
    image_name VARCHAR(255) NOT NULL,
    alt_text VARCHAR(255),
    storage_path TEXT NOT NULL,
    storage_url TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    file_size BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_technical_docs_category_id ON technical_docs(category_id);
CREATE INDEX IF NOT EXISTS idx_technical_docs_status ON technical_docs(status);
CREATE INDEX IF NOT EXISTS idx_technical_docs_created_at ON technical_docs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_technical_docs_title ON technical_docs USING gin(to_tsvector('korean', title));
CREATE INDEX IF NOT EXISTS idx_technical_docs_content ON technical_docs USING gin(to_tsvector('korean', content_html));
CREATE INDEX IF NOT EXISTS idx_technical_doc_attachments_doc_id ON technical_doc_attachments(doc_id);
CREATE INDEX IF NOT EXISTS idx_technical_doc_images_doc_id ON technical_doc_images(doc_id);

-- 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_technical_doc_categories_updated_at 
    BEFORE UPDATE ON technical_doc_categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_technical_docs_updated_at 
    BEFORE UPDATE ON technical_docs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 기본 카테고리 데이터 삽입
INSERT INTO technical_doc_categories (name, description, color) VALUES
    ('일반', '일반적인 기술 문서', '#6B7280'),
    ('API', 'API 관련 문서', '#3B82F6'),
    ('가이드', '사용자 가이드 및 튜토리얼', '#10B981'),
    ('참조', '기술 참조 자료', '#F59E0B'),
    ('FAQ', '자주 묻는 질문', '#EF4444')
ON CONFLICT (name) DO NOTHING;

-- RLS (Row Level Security) 정책 설정
ALTER TABLE technical_doc_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_doc_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_doc_images ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "Enable read access for all users" ON technical_doc_categories FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON technical_docs FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON technical_doc_attachments FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON technical_doc_images FOR SELECT USING (true);

-- 인증된 사용자만 쓰기 가능 (현재는 모든 사용자 허용)
CREATE POLICY "Enable insert for all users" ON technical_doc_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON technical_doc_categories FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON technical_doc_categories FOR DELETE USING (true);

CREATE POLICY "Enable insert for all users" ON technical_docs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON technical_docs FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON technical_docs FOR DELETE USING (true);

CREATE POLICY "Enable insert for all users" ON technical_doc_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON technical_doc_attachments FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON technical_doc_attachments FOR DELETE USING (true);

CREATE POLICY "Enable insert for all users" ON technical_doc_images FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON technical_doc_images FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON technical_doc_images FOR DELETE USING (true);