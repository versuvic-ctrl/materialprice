-- 기술문서 이미지용 Storage 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'technical-doc-images',
    'technical-doc-images',
    true,
    52428800, -- 50MB
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

-- 기술문서 첨부파일용 Storage 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'technical-doc-attachments',
    'technical-doc-attachments',
    true,
    104857600, -- 100MB
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'application/zip',
        'application/x-zip-compressed'
    ]
) ON CONFLICT (id) DO NOTHING;

-- Storage 정책 설정 (이미지 버킷)
CREATE POLICY "Public read access for technical doc images"
ON storage.objects FOR SELECT
USING (bucket_id = 'technical-doc-images');

CREATE POLICY "Authenticated users can upload technical doc images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'technical-doc-images');

CREATE POLICY "Users can update their technical doc images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'technical-doc-images');

CREATE POLICY "Users can delete their technical doc images"
ON storage.objects FOR DELETE
USING (bucket_id = 'technical-doc-images');

-- Storage 정책 설정 (첨부파일 버킷)
CREATE POLICY "Public read access for technical doc attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'technical-doc-attachments');

CREATE POLICY "Authenticated users can upload technical doc attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'technical-doc-attachments');

CREATE POLICY "Users can update their technical doc attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'technical-doc-attachments');

CREATE POLICY "Users can delete their technical doc attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'technical-doc-attachments');