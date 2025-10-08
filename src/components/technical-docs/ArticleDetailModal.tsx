'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Eye, Edit, ArrowLeft, User } from 'lucide-react';
import { TechnicalArticle, Category } from '@/types/technical-docs';

interface ArticleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: TechnicalArticle | null;
  category: Category | null;
  onEdit?: () => void;
  isAuthenticated: boolean;
}

const ArticleDetailModal: React.FC<ArticleDetailModalProps> = ({
  isOpen,
  onClose,
  article,
  category,
  onEdit,
  isAuthenticated,
}) => {
  if (!article) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold mb-2">
                {article.title}
              </DialogTitle>
              
              {/* 메타 정보 */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                {category && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    {category.icon} {category.name}
                  </Badge>
                )}
                
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>작성: {formatDate(article.created_at)}</span>
                </div>
                
                {article.updated_at !== article.created_at && (
                  <div className="flex items-center gap-1">
                    <Edit className="h-4 w-4" />
                    <span>수정: {formatDate(article.updated_at)}</span>
                  </div>
                )}
                
                {article.views && (
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    <span>{article.views} 조회</span>
                  </div>
                )}
                
                {article.author && (
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>{article.author}</span>
                  </div>
                )}
              </div>
              
              {/* 요약 */}
              {article.summary && (
                <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                  <p className="text-sm text-blue-800 font-medium">요약</p>
                  <p className="text-sm text-blue-700 mt-1">{article.summary}</p>
                </div>
              )}
              
              {/* 태그 */}
              {article.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {article.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            {/* 액션 버튼 */}
            <div className="flex gap-2 ml-4">
              {isAuthenticated && onEdit && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  수정
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onClose}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                목록
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* 본문 내용 */}
        <div className="flex-1 overflow-y-auto mt-6">
          <div 
            className="prose prose-sm sm:prose lg:prose-lg xl:prose-2xl max-w-none
                       prose-headings:text-gray-900 prose-headings:font-bold
                       prose-p:text-gray-700 prose-p:leading-relaxed
                       prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                       prose-strong:text-gray-900 prose-strong:font-semibold
                       prose-code:text-pink-600 prose-code:bg-pink-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                       prose-pre:bg-gray-900 prose-pre:text-gray-100
                       prose-blockquote:border-l-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:text-blue-900
                       prose-table:text-sm
                       prose-th:bg-gray-50 prose-th:font-semibold
                       prose-td:border-gray-200
                       prose-img:rounded-lg prose-img:shadow-md"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </div>

        {/* 푸터 정보 */}
        <div className="flex-shrink-0 mt-6 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <div>
              글 ID: {article.id}
            </div>
            <div>
              마지막 수정: {formatDate(article.updated_at)}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ArticleDetailModal;