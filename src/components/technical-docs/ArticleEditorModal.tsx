'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Save, Eye, EyeOff } from 'lucide-react';
import TiptapEditor from './TiptapEditor';
import { Category, TechnicalArticle } from '@/types/technical-docs';

interface ArticleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (article: Partial<TechnicalArticle>) => Promise<void>;
  article?: TechnicalArticle | null;
  categories: Category[];
  isLoading?: boolean;
}

const ArticleEditorModal: React.FC<ArticleEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  article,
  categories,
  isLoading = false,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 모든 카테고리를 평면화 (하위 카테고리 포함)
  const flattenCategories = (categories: Category[]): Category[] => {
    const flattened: Category[] = [];
    
    const flatten = (cats: Category[], prefix = '') => {
      cats.forEach(cat => {
        flattened.push({
          ...cat,
          name: prefix + cat.name
        });
        if (cat.children && cat.children.length > 0) {
          flatten(cat.children, prefix + cat.name + ' > ');
        }
      });
    };
    
    flatten(categories);
    return flattened;
  };

  const flatCategories = flattenCategories(categories);

  // 글 데이터 초기화
  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setContent(article.content);
      setSummary(article.summary || '');
      setCategoryId(article.category_id);
      setTags(article.tags);
    } else {
      setTitle('');
      setContent('');
      setSummary('');
      setCategoryId('');
      setTags([]);
    }
    setTagInput('');
    setIsPreviewMode(false);
  }, [article, isOpen]);

  // 태그 추가
  const addTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  // 태그 제거
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // 태그 입력 핸들러
  const handleTagInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  // 저장 핸들러
  const handleSave = async () => {
    if (!title.trim() || !content.trim() || !categoryId) {
      alert('제목, 내용, 카테고리를 모두 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        content,
        summary: summary.trim() || undefined,
        category_id: categoryId,
        tags,
      });
      onClose();
    } catch (error) {
      console.error('글 저장 중 오류:', error);
      alert('글 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 요약 자동 생성
  const generateSummary = () => {
    const textContent = content.replace(/<[^>]*>/g, ''); // HTML 태그 제거
    const summary = textContent.substring(0, 200).trim();
    setSummary(summary + (textContent.length > 200 ? '...' : ''));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {article ? '글 수정' : '새 글 작성'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* 기본 정보 */}
          <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">제목 *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="글 제목을 입력하세요"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">카테고리 *</Label>
              <Select value={categoryId} onValueChange={setCategoryId} disabled={isSaving}>
                <SelectTrigger>
                  <SelectValue placeholder="카테고리를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {flatCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 요약 */}
          <div className="flex-shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="summary">요약</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateSummary}
                disabled={!content || isSaving}
              >
                자동 생성
              </Button>
            </div>
            <Input
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="글 요약을 입력하세요 (선택사항)"
              disabled={isSaving}
            />
          </div>

          {/* 태그 */}
          <div className="flex-shrink-0 space-y-2">
            <Label htmlFor="tags">태그</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleTagInputKeyPress}
                placeholder="태그를 입력하고 Enter를 누르세요"
                disabled={isSaving}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addTag}
                disabled={!tagInput.trim() || isSaving}
              >
                추가
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      disabled={isSaving}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* 에디터 헤더 */}
          <div className="flex-shrink-0 flex items-center justify-between border-b pb-2">
            <Label>내용 *</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              disabled={isSaving}
            >
              {isPreviewMode ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  편집
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  미리보기
                </>
              )}
            </Button>
          </div>

          {/* 에디터 */}
          <div className="flex-1 overflow-hidden">
            {isPreviewMode ? (
              <div className="h-full overflow-y-auto border border-gray-300 rounded-lg p-4">
                <div 
                  className="prose prose-sm sm:prose lg:prose-lg xl:prose-2xl max-w-none"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              </div>
            ) : (
              <TiptapEditor
                content={content}
                onChange={setContent}
                placeholder="글 내용을 입력하세요..."
                editable={!isSaving}
                className="h-full"
              />
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="flex-shrink-0 flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              취소
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !title.trim() || !content.trim() || !categoryId}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {article ? '수정' : '저장'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ArticleEditorModal;