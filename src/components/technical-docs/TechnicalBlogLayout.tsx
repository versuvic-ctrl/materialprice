'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, Calendar, Eye, Edit, Trash2, ChevronDown, ChevronRight, ChevronLeft, Settings, Menu, X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Category, TechnicalArticle, SearchFilters, DEFAULT_CATEGORIES } from '@/types/technical-docs';
import CategoryManager from './CategoryManager';
import TiptapEditor from './TiptapEditor';

interface TechnicalBlogLayoutProps {
  articles: TechnicalArticle[];
  categories: Category[];
  onCreateArticle: () => void;
  onEditArticle: (article: TechnicalArticle) => void;
  onDeleteArticle: (articleId: string) => void;
  onViewArticle: (article: TechnicalArticle) => void;
  isAuthenticated: boolean;
  searchFilters: SearchFilters;
  onSearchFiltersChange: (filters: SearchFilters) => void;
  onUpdateCategories?: (categories: Category[]) => Promise<void>;
  // 에디터 관련 props
  isEditorMode?: boolean;
  editorTitle?: string;
  editorContent?: string;
  selectedCategory?: string;
  onTitleChange?: (title: string) => void;
  onContentChange?: (content: string) => void;
  onCategoryChange?: (category: string) => void;
  onSaveArticle?: () => void;
  onCancelEdit?: () => void;
}

const TechnicalBlogLayout: React.FC<TechnicalBlogLayoutProps> = ({
  articles,
  categories,
  onCreateArticle,
  onEditArticle,
  onDeleteArticle,
  onViewArticle,
  isAuthenticated,
  searchFilters,
  onSearchFiltersChange,
  onUpdateCategories,
  // 에디터 관련 props
  isEditorMode = false,
  editorTitle = '',
  editorContent = '',
  selectedCategory: editorSelectedCategory = '',
  onTitleChange,
  onContentChange,
  onCategoryChange,
  onSaveArticle,
  onCancelEdit,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<TechnicalArticle | null>(null);

  // 카테고리 확장/축소 토글
  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // 카테고리별 글 개수 계산
  const getCategoryArticleCount = (categoryId: string): number => {
    return (articles || []).filter(article => article.category_id === categoryId).length;
  };

  // 필터링된 글 목록
  const filteredArticles = (articles || []).filter(article => {
    // 카테고리 필터
    if (selectedCategory && article.category_id !== selectedCategory) {
      return false;
    }

    // 검색어 필터
    if (searchFilters.searchTerm) {
      const searchLower = searchFilters.searchTerm.toLowerCase();
      return (
        article.title.toLowerCase().includes(searchLower) ||
        article.content.toLowerCase().includes(searchLower) ||
        article.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    return true;
  });

  // 정렬된 글 목록
  const sortedArticles = [...filteredArticles].sort((a, b) => {
    switch (searchFilters.sortBy) {
      case 'created_at':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'updated_at':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      case 'title':
        return a.title.localeCompare(b.title);
      case 'views':
        return (b.views || 0) - (a.views || 0);
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  // 카테고리 렌더링 (재귀적으로 하위 카테고리 포함)
  const renderCategory = (category: Category, level: number = 0) => {
    const isExpanded = expandedCategories.has(category.id);
    const hasChildren = category.children && category.children.length > 0;
    const articleCount = getCategoryArticleCount(category.id);
    const isSelected = selectedCategory === category.id;

    return (
      <div key={category.id} className={`ml-${level * 4}`}>
        <div
          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-gray-100 ${
            isSelected ? 'bg-blue-100 border-l-4 border-blue-500' : ''
          }`}
          onClick={() => setSelectedCategory(isSelected ? null : category.id)}
        >
          <div className="flex items-center gap-2">
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCategory(category.id);
                }}
                className="p-1 hover:bg-gray-200 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
            <span className="text-sm font-medium">{category.icon} {category.name}</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {articleCount}
          </Badge>
        </div>

        {hasChildren && isExpanded && (
          <div className="ml-4">
            {(category.children || []).map(child => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // 글 카드 렌더링
  const renderArticleCard = (article: TechnicalArticle) => {
    const category = categories.find(cat => cat.id === article.category_id);
    
    return (
      <Card 
        key={article.id} 
        className="hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => setSelectedArticle(article)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                {article.title}
              </CardTitle>
              {article.summary && (
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                  {article.summary}
                </p>
              )}
            </div>
            {isAuthenticated && (
              <div className="flex space-x-1 ml-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditArticle?.(article);
                  }}
                  className="h-8 w-8 p-0"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteArticle?.(article.id);
                  }}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {new Date(article.created_at).toLocaleDateString('ko-KR')}
              </div>
              {article.views !== undefined && (
                <div className="flex items-center">
                  <Eye className="h-4 w-4 mr-1" />
                  {article.views.toLocaleString()}
                </div>
              )}
            </div>
          </div>
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {article.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex h-screen">
      {/* 사이드바 */}
      <div className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} border-r border-gray-200 bg-gray-50 transition-all duration-300 overflow-hidden flex flex-col h-full`}>
        {/* 사이드바 헤더 */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            {!isSidebarCollapsed && (
              <h2 className="text-lg font-semibold text-gray-900">기술자료</h2>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="h-8 w-8 p-0"
            >
              {isSidebarCollapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* 사이드바 콘텐츠 */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 h-full">
          {!isSidebarCollapsed && (
            <div className="space-y-4 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              {/* 새 글 작성 버튼 */}
              <Button 
                onClick={onCreateArticle}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                새 글 작성
              </Button>

              {/* 검색 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="글 검색..."
                  value={searchFilters.searchTerm}
                  onChange={(e) => onSearchFiltersChange({ ...searchFilters, searchTerm: e.target.value })}
                  className="pl-10"
                />
              </div>

              {/* 정렬 옵션 */}
              <Select
                value={searchFilters.sortBy}
                onValueChange={(value) => onSearchFiltersChange({ ...searchFilters, sortBy: value as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="정렬 기준" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">최신순</SelectItem>
                  <SelectItem value="updated_at">수정일순</SelectItem>
                  <SelectItem value="title">제목순</SelectItem>
                  <SelectItem value="views">조회수순</SelectItem>
                </SelectContent>
              </Select>

              {/* 전체 글 보기 */}
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => setSelectedCategory(null)}
              >
                📚 전체 글 ({(articles || []).length})
              </Button>

              {/* 카테고리 목록 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">카테고리</h3>
                  {isAuthenticated && onUpdateCategories && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsCategoryManagerOpen(true)}
                      className="h-6 w-6 p-0"
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {(categories || []).map(category => renderCategory(category))}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 overflow-hidden">
        {isEditorMode ? (
          /* 새 글 작성 */
          <div className="h-full flex flex-col">
            {/* 에디터 헤더 */}
            <div className="border-b border-gray-200 px-4 py-2">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={onCancelEdit}
                  className="flex items-center h-8 px-3"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  목록으로 돌아가기
                </Button>
                <h2 className="text-base font-semibold text-gray-900">새 글 작성</h2>
                <div className="flex items-center space-x-3">
                  <Select value={editorSelectedCategory} onValueChange={onCategoryChange}>
                    <SelectTrigger className="w-40 h-8 text-sm bg-white border border-gray-300">
                      <SelectValue placeholder="카테고리 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.icon} {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 에디터 */}
            <div className="flex-1 overflow-hidden p-6">
              <div className="max-w-4xl mx-auto h-full">
                <TiptapEditor
                  title={editorTitle}
                  content={editorContent}
                  selectedCategory={editorSelectedCategory}
                  categories={categories}
                  onTitleChange={onTitleChange}
                  onChange={onContentChange}
                  onCategoryChange={onCategoryChange}
                  onSave={onSaveArticle}
                  showToolbar={true}
                />
              </div>
            </div>
          </div>
        ) : selectedArticle ? (
          /* 글 상세보기 */
          <div className="h-full flex flex-col">
            {/* 상세보기 헤더 */}
            <div className="border-b border-gray-200 px-4 py-2">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedArticle(null)}
                  className="flex items-center h-8 px-3"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  목록으로 돌아가기
                </Button>
                {isAuthenticated && (
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditArticle?.(selectedArticle)}
                      className="h-8 px-3"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      편집
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDeleteArticle?.(selectedArticle.id)}
                      className="text-red-600 hover:text-red-700 h-8 px-3"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      삭제
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* 글 내용 */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                  {selectedArticle.title}
                </h1>
                
                <div className="flex items-center space-x-4 text-sm text-gray-500 mb-6">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {new Date(selectedArticle.created_at).toLocaleDateString('ko-KR')}
                  </div>
                  {selectedArticle.views !== undefined && (
                    <div className="flex items-center">
                      <Eye className="h-4 w-4 mr-1" />
                      {selectedArticle.views.toLocaleString()}
                    </div>
                  )}
                </div>

                {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {selectedArticle.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {selectedArticle.summary && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-2">요약</h3>
                    <p className="text-gray-700">{selectedArticle.summary}</p>
                  </div>
                )}

                <div 
                  className="prose prose-lg max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* 글 목록 */
          <div className="p-6 overflow-y-auto h-full">
            <div className="max-w-4xl mx-auto">
              {/* 헤더 */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {selectedCategory 
                    ? categories.find(cat => cat.id === selectedCategory)?.name || '카테고리'
                    : '기술자료'
                  }
                </h1>
                <p className="text-gray-600">
                  {selectedCategory
                    ? `${filteredArticles.length}개의 글`
                    : `총 ${(articles || []).length}개의 기술자료가 있습니다.`
                  }
                </p>
              </div>

              {/* 글 목록 */}
              <div className="space-y-4">
                {sortedArticles.length > 0 ? (
                  sortedArticles.map(article => renderArticleCard(article))
                ) : (
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 border border-sky-100 p-12 text-center">
                    {/* 배경 장식 */}
                    <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
                    <div className="absolute top-4 right-4 w-32 h-32 bg-gradient-to-br from-sky-200 to-blue-300 rounded-full opacity-20 blur-2xl"></div>
                    <div className="absolute bottom-4 left-4 w-24 h-24 bg-gradient-to-br from-indigo-200 to-purple-300 rounded-full opacity-20 blur-xl"></div>
                    
                    {/* 메인 콘텐츠 */}
                    <div className="relative z-10">
                      <div className="mb-6">
                        {(articles || []).length === 0 ? (
                          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-sky-400 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <Plus className="h-10 w-10 text-white" />
                          </div>
                        ) : (
                          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-400 to-gray-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <Search className="h-10 w-10 text-white" />
                          </div>
                        )}
                      </div>
                      
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-3">
                        {(articles || []).length === 0 ? '새로운 시작을 기다리고 있어요' : '찾는 글이 없어요'}
                      </h3>
                      
                      <p className="text-gray-600 text-lg mb-8 max-w-md mx-auto leading-relaxed">
                        {(articles || []).length === 0 
                          ? '첫 번째 기술 문서로 지식 공유의 여정을 시작해보세요. 당신의 경험과 노하우가 다른 사람들에게 큰 도움이 될 거예요.'
                          : selectedCategory 
                            ? '이 카테고리에는 아직 글이 없습니다. 새로운 글로 카테고리를 채워보세요!'
                            : '검색 조건을 조정하거나 새로운 글을 작성해보세요.'
                        }
                      </p>
                      
                      <Button 
                        onClick={onCreateArticle} 
                        className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                      >
                        <Plus className="h-5 w-5 mr-2" />
                        {(articles || []).length === 0 ? '첫 번째 글 작성하기' : '새 글 작성하기'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 카테고리 관리 모달 */}
      {isAuthenticated && onUpdateCategories && (
        <CategoryManager
          isOpen={isCategoryManagerOpen}
          onClose={() => setIsCategoryManagerOpen(false)}
          categories={categories || []}
          onUpdateCategories={onUpdateCategories}
        />
      )}
    </div>
  );
};

export default TechnicalBlogLayout;