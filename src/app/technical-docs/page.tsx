'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import Layout from '@/components/layout/Layout';
import TechnicalBlogLayout from '@/components/technical-docs/TechnicalBlogLayout';
import TiptapEditor from '@/components/technical-docs/TiptapEditor';
import ArticleDetailModal from '@/components/technical-docs/ArticleDetailModal';
import PasswordAuthModal from '@/components/technical-docs/PasswordAuthModal';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save } from 'lucide-react';
import { 
  TechnicalArticle, 
  Category, 
  SearchFilters, 
  EditorState, 
  AuthState,
  DEFAULT_CATEGORIES 
} from '@/types/technical-docs';

const supabase = createClient();

// slug 생성 함수
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '') // 특수문자 제거
    .replace(/\s+/g, '-') // 공백을 하이픈으로
    .replace(/-+/g, '-') // 연속된 하이픈 제거
    .trim()
    .substring(0, 100); // 길이 제한
};

// 카테고리 이름으로 ID 찾기 함수
const findCategoryIdByName = (categoryName: string, categories: Category[]): string | null => {
  const category = categories.find(cat => cat.name === categoryName);
  return category ? category.id : null;
};

export default function TechnicalDocsPage() {
  // 상태 관리
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [isEditorMode, setIsEditorMode] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<TechnicalArticle | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [pendingAction, setPendingAction] = useState<'create' | 'edit' | null>(null);
  
  // 인증 상태
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    sessionExpiry: null
  });

  // 검색 및 필터 상태
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    searchTerm: '',
    selectedCategory: null,
    sortBy: 'created_at',
    sortOrder: 'desc'
  });

  // 카테고리 상태
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);

  const queryClient = useQueryClient();

  // 카테고리 목록 조회
  const { data: categoriesData = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Category[];
    }
  });

  // 글 목록 조회
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['technical-articles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('technical_articles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as TechnicalArticle[];
    }
  });

  // 글 생성
  const createArticle = useMutation({
    mutationFn: async (article: Omit<TechnicalArticle, 'id' | 'createdAt'>) => {
      // slug 생성
      const slug = generateSlug(article.title);

      const articleData = {
        title: article.title,
        slug,
        content: article.content,
        summary: article.excerpt || '',
        category_id: article.categoryId,
        tags: article.tags || [],
        author: article.author || 'Admin',
        status: article.status || 'published'
      };

      const { data, error } = await supabase
        .from('technical_articles')
        .insert([articleData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical-articles'] });
    }
  });

  // 글 수정
  const updateArticle = useMutation({
    mutationFn: async (article: TechnicalArticle) => {
      // slug 생성
      const slug = generateSlug(article.title);

      const updateData = {
        title: article.title,
        slug,
        content: article.content,
        summary: article.excerpt || '',
        category_id: article.categoryId,
        tags: article.tags || []
      };

      const { data, error } = await supabase
        .from('technical_articles')
        .update(updateData)
        .eq('id', article.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical-articles'] });
    }
  });

  // 글 삭제
  const deleteArticle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('technical_articles')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical-articles'] });
      setSelectedArticleId(null);
    }
  });

  // 선택된 글
  const selectedArticle = useMemo(() => 
    articles.find(article => article.id === selectedArticleId),
    [articles, selectedArticleId]
  );

  // 검색 및 카테고리별 필터링
  const filteredArticlesByCategory = useMemo(() => {
    const filtered = articles.filter(article =>
      article.title.toLowerCase().includes(searchFilters.searchTerm.toLowerCase()) ||
      article.content.toLowerCase().includes(searchFilters.searchTerm.toLowerCase()) ||
      article.tags.some(tag => tag.toLowerCase().includes(searchFilters.searchTerm.toLowerCase()))
    );

    return filtered.reduce((acc, article) => {
      if (!acc[article.category]) {
        acc[article.category] = [];
      }
      acc[article.category].push(article);
      return acc;
    }, {} as Record<string, TechnicalArticle[]>);
  }, [articles, searchFilters.searchTerm]);

  // 인증 처리
  const handlePasswordSubmit = (password: string) => {
    // 인증 성공 (PasswordAuthModal에서 이미 검증됨)
    setAuthState({
      isAuthenticated: true,
      sessionExpiry: Date.now() + (24 * 60 * 60 * 1000) // 24시간
    });
    
    // 인증 성공 후 대기 중인 액션 실행
    if (pendingAction === 'create') {
      setIsEditorMode(true);
      setEditingArticle(null);
      setEditorTitle('');
      setEditorContent('');
      setSelectedCategory('');
    } else if (pendingAction === 'edit' && editingArticle) {
      setIsEditorMode(true);
      setEditorTitle(editingArticle.title);
      setEditorContent(editingArticle.content);
      setSelectedCategory(editingArticle.category);
    }
    setPendingAction(null);
  };

  // 글 작성/수정 처리
  const handleCreateArticle = () => {
    if (!authState.isAuthenticated) {
      setPendingAction('create');
      setIsPasswordModalOpen(true);
      return;
    }
    
    setIsEditorMode(true);
    setEditingArticle(null);
    setEditorTitle('');
    setEditorContent('');
    setSelectedCategory('');
  };

  const handleEditArticle = (article: TechnicalArticle) => {
    if (!authState.isAuthenticated) {
      setEditingArticle(article);
      setPendingAction('edit');
      setIsPasswordModalOpen(true);
      return;
    }
    
    setIsEditorMode(true);
    setEditingArticle(article);
    setEditorTitle(article.title);
    setEditorContent(article.content);
    setSelectedCategory(article.category);
  };

  const handleDeleteArticle = (id: string) => {
    if (window.confirm('정말로 이 글을 삭제하시겠습니까?')) {
      deleteArticle.mutate(id);
    }
  };

  const handleSaveArticle = async () => {
    if (!editorTitle.trim() || !editorContent.trim() || !selectedCategory) {
      alert('제목, 내용, 카테고리를 모두 입력해주세요.');
      return;
    }

    try {
      // 카테고리 데이터가 로드되었는지 확인
      if (!categoriesData || categoriesData.length === 0) {
        alert('카테고리 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      // 카테고리 ID 찾기
      const categoryId = findCategoryIdByName(selectedCategory, categoriesData);
      if (!categoryId) {
        alert(`선택한 카테고리를 찾을 수 없습니다: ${selectedCategory}`);
        return;
      }

      const articleData = {
        title: editorTitle,
        content: editorContent,
        categoryId: categoryId,
        excerpt: editorContent.substring(0, 200) + '...', // 내용의 첫 200자를 요약으로 사용
        tags: [], // 필요시 태그 기능 추가
        author: 'Admin',
        status: 'published' as const,
        featured: false,
        viewCount: 0,
        likeCount: 0,
        slug: '', // mutation에서 생성
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (editingArticle) {
        await updateArticle.mutateAsync({ ...articleData, id: editingArticle.id } as TechnicalArticle);
      } else {
        await createArticle.mutateAsync(articleData);
      }
      
      // 에디터 모드 종료 및 상태 초기화
      setIsEditorMode(false);
      setEditingArticle(null);
      setEditorTitle('');
      setEditorContent('');
      setSelectedCategory('');
    } catch (error) {
      console.error('Failed to save article - Detailed Error:', {
        error,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        errorString: String(error),
        errorJSON: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        articleData: {
          title: editorTitle,
          category: selectedCategory,
          contentLength: editorContent.length,
          categoriesDataLength: categoriesData?.length || 0,
          editingArticle: editingArticle ? { id: editingArticle.id, title: editingArticle.title } : null
        },
        mutationStates: {
          createArticleLoading: createArticle.isPending,
          updateArticleLoading: updateArticle.isPending,
          createArticleError: createArticle.error?.message,
          updateArticleError: updateArticle.error?.message
        }
      });
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      alert(`글 저장에 실패했습니다: ${errorMessage}`);
    }
  };

  const handleCancelEdit = () => {
    if (window.confirm('작성 중인 내용이 사라집니다. 정말 취소하시겠습니까?')) {
      setIsEditorMode(false);
      setEditingArticle(null);
      setEditorTitle('');
      setEditorContent('');
      setSelectedCategory('');
    }
  };

  // 글 상세보기
  const handleViewArticle = (article: TechnicalArticle) => {
    setSelectedArticleId(article.id);
    setIsDetailOpen(true);
  };

  // 카테고리 업데이트 처리
  const handleUpdateCategories = async (updatedCategories: Category[]) => {
    try {
      setCategories(updatedCategories);
      // 여기에 카테고리를 서버에 저장하는 로직을 추가할 수 있습니다
      console.log('Categories updated:', updatedCategories);
    } catch (error) {
      console.error('Failed to update categories:', error);
      throw error;
    }
  };

  // 세션 만료 체크
  useEffect(() => {
    if (authState.isAuthenticated && authState.sessionExpiry) {
      const timer = setTimeout(() => {
        if (Date.now() > authState.sessionExpiry!) {
          setAuthState({ isAuthenticated: false, sessionExpiry: null });
        }
      }, 60000); // 1분마다 체크

      return () => clearTimeout(timer);
    }
  }, [authState]);

  return (
    <Layout title="기술 자료">
      <TechnicalBlogLayout
        articles={articles}
        categories={categories}
        onCreateArticle={handleCreateArticle}
        onEditArticle={handleEditArticle}
        onDeleteArticle={handleDeleteArticle}
        onViewArticle={handleViewArticle}
        isAuthenticated={authState.isAuthenticated}
        searchFilters={searchFilters}
        onSearchFiltersChange={setSearchFilters}
        onUpdateCategories={handleUpdateCategories}
        // 에디터 관련 props
        isEditorMode={isEditorMode}
        editorTitle={editorTitle}
        editorContent={editorContent}
        selectedCategory={selectedCategory}
        onTitleChange={setEditorTitle}
        onContentChange={setEditorContent}
        onCategoryChange={setSelectedCategory}
        onSaveArticle={handleSaveArticle}
        onCancelEdit={handleCancelEdit}
      />

      {/* 글 상세보기 모달 */}
      <ArticleDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedArticleId(null);
        }}
        article={selectedArticle}
        category={selectedArticle ? categories.find(cat => cat.id === selectedArticle.category_id) || null : null}
        onEdit={() => selectedArticle && handleEditArticle(selectedArticle)}
        isAuthenticated={authState.isAuthenticated}
      />

      {/* 비밀번호 인증 모달 */}
      <PasswordAuthModal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setPendingAction(null);
        }}
        onSubmit={handlePasswordSubmit}
      />
    </Layout>
  );
}