"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as ReactDOM from 'react-dom';


import { 
  PlusIcon, 
  ArrowLeftIcon, 
  TagIcon, 
  CalendarIcon,
  DocumentTextIcon,
  PhotoIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plus, Edit, Trash2, Save, X, Upload, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import Image from 'next/image';

const Jodit = dynamic(() => import('jodit-react'), { ssr: false });
import { koLang } from './jodit-ko';
import { createClient } from '@supabase/supabase-js';



// 타입 정의
interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
  images?: string[];
  tags?: string; // 태그 필드 추가
  preview_image?: string; // 미리보기 이미지 URL
  preview_text?: string; // 미리보기 텍스트
  preview_table?: string; // 미리보기 테이블 HTML
}

// 카테고리 목록
const categories = ['전체', '기계/배관', '전기/계기', '규격/법규', '기타'];

export default function TechnicalDataPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewingArticle, setViewingArticle] = useState<Article | null>(null);
  const [isWriting, setIsWriting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('기계/배관');
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false); // 비밀번호 입력창 표시 여부
  const [inputPassword, setInputPassword] = useState(''); // 입력된 비밀번호
  const [passwordError, setPasswordError] = useState(''); // 비밀번호 오류 메시지
  const [articleToDeleteId, setArticleToDeleteId] = useState<string | null>(null); // 삭제할 글의 ID
  const [articleToEdit, setArticleToEdit] = useState<Article | null>(null); // 수정할 글의 ID
  const [pendingAction, setPendingAction] = useState<'save' | 'edit' | 'delete' | null>(null); // 비밀번호 확인 후 실행할 작업




  // 이미지 업로드 핸들러
  const handleImageUpload = useCallback(async (file: File) => {
    // 파일이 없으면 파일 선택 다이얼로그 열기
    if (!file) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const selectedFile = (e.target as HTMLInputElement).files?.[0];
        if (selectedFile) {
          handleImageUpload(selectedFile);
        }
      };
      input.click();
      return false; // 기본 업로드 동작 방지
    }

    // 드래그 앤 드롭이나 붙여넣기로 파일이 들어온 경우
    if (file && file.type.startsWith('image/')) {
      await uploadImageToSupabase(file);
      return false; // 기본 업로드 동작 방지
    }
  }, []);

  // Supabase에 이미지 업로드하는 함수
  const uploadImageToSupabase = async (file: File) => {
    try {
      // 파일명 생성 (타임스탬프 + 원본 파일명)
      const fileName = `${Date.now()}_${file.name}`;
      
      // Supabase Storage에 업로드
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data, error } = await supabase.storage
        .from('article_images')
        .upload(fileName, file);

      if (error) {
        alert('이미지 업로드에 실패했습니다.');
        return;
      }

      // 업로드된 이미지의 공개 URL 가져오기
      const { data: { publicUrl } } = supabase.storage
        .from('article_images')
        .getPublicUrl(fileName);

      // Jodit 에디터에 이미지 삽입
      setContent((prevContent) => prevContent + `<img src="${publicUrl}" alt="업로드된 이미지" style="max-width: 100%; height: auto;" />`);
    } catch (error) {
      console.error('Image upload error:', error);
      alert('이미지 업로드 중 오류가 발생했습니다.');
    }
  };

  // Jodit 에디터 참조
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const joditInstance = useRef<any>(null);

  // Lazy-load Jodit plugins and language only when editor is needed
  useEffect(() => {
    if (isEditing || isWriting) {
      (async () => {
        try {
          await Promise.all([
            import('jodit/esm/plugins/all.js'),
            import('jodit/esm/langs/ko.js'),
          ]);
        } catch (e) {
          console.error('Failed to load Jodit plugins/lang:', e);
        }
      })();
    }
  }, [isEditing, isWriting]);

  const editorConfig = useMemo(() => ({
    readonly: false,
    toolbar: true,
    spellcheck: false,
    language: 'ko',
    height: 500,
    buttons: 'paragraph,bold,strikethrough,underline,italic,|,superscript,subscript,|,ul,ol,|,align,outdent,indent,|,font,fontsize,brush,color,|,image,video,link,table,cut,hr,|,symbol,selectall,file,print,about',
    buttonsMD: 'paragraph,bold,strikethrough,underline,italic,|,superscript,subscript,|,ul,ol,|,align,outdent,indent,|,font,fontsize,brush,color,|,image,video,link,table,cut,hr,|,symbol,selectall,file,print,about',
    buttonsSM: 'paragraph,bold,strikethrough,underline,italic,|,superscript,subscript,|,ul,ol,|,align,outdent,indent,|,font,fontsize,brush,color,|,image,video,link,table,cut,hr,|,symbol,selectall,file,print,about',
    buttonsXS: 'paragraph,bold,strikethrough,underline,italic,|,superscript,subscript,|,ul,ol,|,align,outdent,indent,|,font,fontsize,brush,color,|,image,video,link,table,cut,hr,|,symbol,selectall,file,print,about',
    events: {
      afterInit: (editor: any) => {
        console.log('Jodit 에디터 초기화 완료');
      },
    },
    // Prefer text tab in color picker; if unsupported, Jodit will ignore
    colorPickerDefaultTab: 'text',
    uploader: {
      insertImageAsBase64URI: true,
    },
    filebrowser: {
      ajax: {
        url: '/api/upload',
      },
    },
  }), []);




  // 글 목록 가져오기 (최적화: 목록에 필요한 필드만 선택)
  useEffect(() => {
    let isMounted = true;
    const fetchArticles = async () => {
      try {
        setIsLoading(true);
        // API 라우트에서 캐싱된 기술 자료 목록을 가져옵니다.
        const response = await fetch('/api/technical-articles', {
          // 브라우저 캐시 활용 (서버 캐시와 병행)
          cache: 'force-cache',
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // 컴포넌트가 마운트된 상태에서만 상태 업데이트
        if (isMounted) {
          setArticles(data);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error fetching articles:', error);
          toast.error('기술 자료를 불러오는 데 실패했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchArticles();
    return () => {
      isMounted = false;
    };
  }, []);

  // 로딩 중일 때 스크롤 비활성화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isLoading) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'unset';
      }
    }

    // 컴포넌트 언마운트 시 정리
    return () => {
      if (typeof window !== 'undefined') {
        document.body.style.overflow = 'unset';
      }
    };
  }, [isLoading]);

  // 새 글 저장
  const handleSave = async () => {
    // 비밀번호 확인 로직 추가
    if (!showPasswordPrompt) {
      setPendingAction('save');
      setShowPasswordPrompt(true);
      return;
    }

    if (inputPassword !== process.env.NEXT_PUBLIC_TECHNICAL_DATA_PASSWORD) {
      setPasswordError('비밀번호가 올바르지 않습니다.');
      return;
    }
    setPasswordError(''); // 오류 메시지 초기화

    if (!title.trim() || !content.trim()) {
      toast.error('제목과 내용을 모두 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data, error } = await supabase
        .from('technical_articles')
        .insert([
          {
            title: title.trim(),
            content: content.trim(),
            category: category
          }
        ])
        .select();

      if (error) {
        console.error('Error saving new article:', error);
        toast.error('새 글 저장에 실패했습니다.');
        return;
      }

      toast.success('새 글이 성공적으로 저장되었습니다!');
      setArticles([data[0], ...articles]);
      setTitle('');
      setContent('');
      setCategory('기계/배관');
      setIsWriting(false);
    } catch (error) {
      console.error('Error:', error);
      toast.error('새 글 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
      setShowPasswordPrompt(false); // 비밀번호 입력창 닫기
      setInputPassword(''); // 입력된 비밀번호 초기화
    }
  };

  // 글 수정 시작 (상세 내용 로딩 포함)
  const handleEdit = async (article: Article) => {
    // 비밀번호 확인 로직 추가
    if (!showPasswordPrompt) {
      setShowPasswordPrompt(true);
      setArticleToEdit(article);
      setPendingAction('edit');
      return;
    }

    if (inputPassword !== process.env.NEXT_PUBLIC_TECHNICAL_DATA_PASSWORD) {
      setPasswordError('비밀번호가 올바르지 않습니다.');
      return;
    }
    setPasswordError(''); // 오류 메시지 초기화

    setIsWriting(true);
    setIsEditing(true);
    setEditingArticle(article);
    setTitle(article.title);
    setContent(article.content);
    setCategory(article.category);
    setViewingArticle(null);
    setShowPasswordPrompt(false); // 비밀번호 입력창 닫기
    setInputPassword(''); // 입력된 비밀번호 초기화
    setArticleToEdit(null); // 수정할 글 ID 초기화
  };

  // 글 수정 저장
  const handleUpdate = async () => {
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data, error } = await supabase
        .from('technical_articles')
        .update({
          title: title.trim(),
          content: content.trim(),
          category: category,
        })
        .eq('id', editingArticle!.id)
        .select();

      if (error) {
        console.error('Error updating article:', error);
        toast.error('글 수정에 실패했습니다.');
        return;
      }

      toast.success('글이 성공적으로 수정되었습니다!');
      setArticles(articles.map(article => article.id === editingArticle!.id ? data[0] : article));
      setIsEditing(false);
      setEditingArticle(null);
      setTitle('');
      setContent('');
      setCategory('기계/배관');
    } catch (error) {
      console.error('Error:', error);
      toast.error('글 수정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
      setShowPasswordPrompt(false); // 비밀번호 입력창 닫기
      setInputPassword(''); // 입력된 비밀번호 초기화
    }
  };

  // 글 삭제
  const handleDelete = async () => {
    // 비밀번호 확인 로직을 추가합니다.
    if (!showPasswordPrompt) {
      setShowPasswordPrompt(true);
      setPendingAction('delete');
      return;
    }

    if (inputPassword !== process.env.NEXT_PUBLIC_TECHNICAL_DATA_PASSWORD) {
      setPasswordError('비밀번호가 올바르지 않습니다.');
      return;
    }
    setPasswordError(''); // 오류 메시지 초기화

    if (!articleToDeleteId) {
      toast.error('삭제할 글이 선택되지 않았습니다.');
      return;
    }

    if (!confirm('정말로 이 글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error } = await supabase
        .from('technical_articles')
        .delete()
        .eq('id', articleToDeleteId);

      if (error) {
        console.error('Error deleting article:', error);
        toast.error('글 삭제에 실패했습니다.');
        return;
      }

      toast.success('글이 성공적으로 삭제되었습니다!');
      setArticles(articles.filter(article => article.id !== articleToDeleteId));
      setViewingArticle(null);
    } catch (error) {
      console.error('Error:', error);
      toast.error('글 삭제 중 오류가 발생했습니다.');
    } finally {
      // 비밀번호 입력창 닫기 및 비밀번호 초기화
      setShowPasswordPrompt(false);
      setInputPassword('');
      setArticleToDeleteId(null); // 삭제할 글 ID 초기화
    }
  };

  // 글 상세 내용 가져오기 (최적화: 필요할 때만 content 로딩)
  const fetchArticleDetail = async (articleId: string) => {
    try {
      const response = await fetch(`/api/technical-articles/${articleId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error('Error fetching article detail:', error);
      return null;
    }
  };

  // 글 보기 (상세 내용 로딩 포함)
  const handleViewArticle = async (article: Article) => {
    // 이미 content가 있으면 바로 표시
    if (article.content) {
      setViewingArticle(article);
      return;
    }

    // content가 없으면 상세 내용 가져오기
    const content = await fetchArticleDetail(article.id);
    if (content) {
      const articleWithContent = { ...article, content };
      setViewingArticle(articleWithContent);
      
      // articles 배열도 업데이트하여 다음에는 바로 표시되도록 함
      setArticles(articles.map(a => a.id === article.id ? articleWithContent : a));
    }
  };

  // HTML 태그 제거 함수
  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  // HTML 콘텐츠 에서 이미지 추출 함수
  const extractFirstImage = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const img = tmp.querySelector('img');
    return img ? img.src : null;
  };

  // 필터링된 글 목록
  const filteredArticles = useMemo(() => {
    let filtered = articles;
    
    // 카테고리 필터
    if (selectedCategory !== '전체') {
      filtered = filtered.filter(article => article.category === selectedCategory);
    }
    
    // 검색 필터
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(article => 
        article.title.toLowerCase().includes(searchLower) ||
        stripHtml(article.content).toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }, [articles, selectedCategory, searchTerm]);

  return (
    <>
      {/* 비밀번호 입력 모달 */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg w-[90%] max-w-sm p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">관리자 비밀번호 확인</h3>
            <p className="text-sm text-gray-600 mb-3">해당 작업을 진행하기 위해 비밀번호를 입력하세요.</p>
            <input
              type="password"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="비밀번호"
              autoFocus
            />
            {passwordError && (
              <p className="mt-2 text-sm text-red-600">{passwordError}</p>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowPasswordPrompt(false);
                  setInputPassword('');
                  setPasswordError('');
                  setArticleToEdit(null);
                  setArticleToDeleteId(null);
                  setPendingAction(null);
                }}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={() => {
                  // 즉시 검증하지 않고 각 핸들러에게 위임 (핸들러 내부에서 검증)
                  if (pendingAction === 'save') {
                    void handleSave();
                  } else if (pendingAction === 'edit' && articleToEdit) {
                    void handleEdit(articleToEdit);
                  } else if (pendingAction === 'delete') {
                    void handleDelete();
                  } else {
                    setPasswordError('진행할 작업이 없습니다. 다시 시도하세요.');
                  }
                }}
                className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
      
        {/* 헤더 섹션 */}

        {/* 카테고리 필터 */}
        {!isWriting && !viewingArticle && !isEditing && (
          <div className="mx-auto w-full py-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
                <div className="flex flex-wrap gap-2 min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">카테고리</h3>
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category);
                        setViewingArticle(null);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        selectedCategory === category
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:shadow-sm border border-gray-200'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setIsWriting(true)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md flex-shrink-0 w-full sm:w-auto"
                >
                  <span>새 글 작성</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 메인 콘텐츠 영역 */}
        <div className="mx-auto w-full max-w-full px-0 sm:px-0 lg:px-0">
          {/* 글 상세 보기 */}
          {viewingArticle && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full max-w-full">
              {/* 글 헤더 */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-8 py-6 text-white">
                <button
                  onClick={() => setViewingArticle(null)}
                  className="group flex items-center gap-2 mb-6 text-orange-100 hover:text-white transition-all duration-200"
                >
                  <ArrowLeftIcon className="h-5 w-5 group-hover:-translate-x-1 transition-transform duration-200" />
                  <span className="text-sm font-medium">목록으로 돌아가기</span>
                </button>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold mb-4 break-words">{viewingArticle.title}</h1>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-blue-100">
                      <div className="flex items-center gap-1">
                        <TagIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm truncate">{viewingArticle.category}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm">{new Date(viewingArticle.created_at).toLocaleDateString('ko-KR')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        setArticleToEdit(viewingArticle);
                        setPendingAction('edit');
                        setShowPasswordPrompt(true);
                      }}
                      className="flex items-center gap-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 text-sm"
                    >
                      <PencilIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">수정</span>
                    </button>
                    <button
                      onClick={() => {
                        setArticleToDeleteId(viewingArticle.id);
                        setPendingAction('delete');
                        setShowPasswordPrompt(true);
                      }}
                      className="flex items-center gap-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-all duration-200 text-sm"
                    >
                      <TrashIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">삭제</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 글 내용 */}
              <div className="px-4 sm:px-8 py-8">
                <div 
                  className="prose prose-lg max-w-none w-full overflow-x-auto prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-strong:text-gray-900 prose-code:text-pink-600 prose-code:bg-pink-50 prose-pre:bg-gray-50 prose-pre:overflow-x-auto prose-blockquote:border-blue-200 prose-blockquote:bg-blue-50/50 prose-th:bg-gray-50 prose-td:border-gray-200 prose-table:overflow-x-auto prose-table:block prose-table:whitespace-nowrap sm:prose-table:whitespace-normal"
                  dangerouslySetInnerHTML={{ __html: viewingArticle.content }}
                />
              </div>
            </div>
          )}

          {/* 글 수정 */}
          {isEditing && editingArticle && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* 수정 헤더 */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
                <div className="flex items-center justify-between mb-0">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditingArticle(null);
                      setTitle('');
                      setContent('');
                      setCategory('기계/배관');
                    }}
                    className="group flex items-center gap-2 text-orange-100 hover:text-white transition-all duration-200"
                  >
                    <ArrowLeftIcon className="h-5 w-5 group-hover:-translate-x-1 transition-transform duration-200" />
                    <span className="text-sm font-medium">목록으로 돌아가기</span>
                  </button>
                  <p className="text-base text-blue-100">기술자료를 수정해보세요.</p>
                </div>
              </div>

              {/* 수정 폼 */}
              <div className="px-8 py-8 space-y-0">
                <div className="flex gap-4 mb-4">
                  {/* 제목 입력 */}
                  <div className="flex-grow">
                    <input
                      type="text"
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      placeholder="글 제목을 입력하세요"
                    />
                  </div>

                  {/* 카테고리 선택 */}
                  <div className="w-1/4">
                    <select
                      id="category"
                      aria-label="카테고리 선택"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {categories.filter(cat => cat !== '전체').map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 내용 입력 */}
                <div className="flex justify-between items-center !mb-2">
                    <label htmlFor="jodit-editor" className="block text-sm font-medium text-gray-700 mb-2">
                      내용
                    </label>
                  <button
                    onClick={handleUpdate}
                    disabled={saving}
                    className="flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <DocumentTextIcon className="h-4 w-4" />
                    <span>글 수정</span>
                  </button>
                </div>
                <div className="jodit-editor-container border border-gray-300 rounded-lg overflow-hidden">
                  <Jodit
                    ref={joditInstance}
                    value={content}
                    config={editorConfig as any}
                    onBlur={(newContent: string) => setContent(newContent)}
                    onChange={(newContent: string) => {}}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 글 작성 */}
          {isWriting && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* 작성 헤더 */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() => setIsWriting(false)}
                    className="group flex items-center gap-2 text-orange-100 hover:text-white transition-all duration-200"
                  >
                    <ArrowLeftIcon className="h-5 w-5 group-hover:-translate-x-1 transition-transform duration-200" />
                    <span className="text-sm font-medium">목록으로 돌아가기</span>
                  </button>

                  <p className="text-base text-blue-100 ml-4">기술자료를 작성하여 공유해보세요.</p>
                </div>
              </div>

              {/* 작성 폼 */}
              <div className="px-8 py-8 space-y-0">
                <div className="flex gap-4 mb-4">
                  {/* 제목 입력 */}
                  <div className="flex-grow">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      placeholder="글 제목을 입력하세요"
                    />
                  </div>

                  {/* 카테고리 선택 */}
                  <div className="w-1/4">
                    <select
                      aria-label="카테고리 선택"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {categories.filter(cat => cat !== '전체').map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 내용 입력 */}
                <div className="flex justify-between items-center !mb-2">
                  <label htmlFor="jodit-editor-write" className="block text-sm font-medium text-gray-700">
                    내용
                  </label>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>저장 중...</span>
                      </>
                    ) : (
                      <>
                        <DocumentTextIcon className="h-4 w-4" />
                        <span>저장</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="jodit-editor-container border border-gray-300 rounded-lg overflow-hidden">
                  <Jodit
                    ref={joditInstance}
                    value={content}
                    config={{
                      readonly: false,
                      toolbar: true,
                      spellcheck: false,
                      language: 'ko',
                      height: 500,
                      buttons: 'paragraph,bold,strikethrough,underline,italic,|,superscript,subscript,|,ul,ol,|,align,outdent,indent,|,font,fontsize,brush,color,|,image,video,link,table,cut,hr,|,symbol,selectall,file,print,about',
                      buttonsMD: 'paragraph,bold,strikethrough,underline,italic,|,superscript,subscript,|,ul,ol,|,align,outdent,indent,|,font,fontsize,brush,color,|,image,video,link,table,cut,hr,|,symbol,selectall,file,print,about',
                      buttonsSM: 'paragraph,bold,strikethrough,underline,italic,|,superscript,subscript,|,ul,ol,|,align,outdent,indent,|,font,fontsize,brush,color,|,image,video,link,table,cut,hr,|,symbol,selectall,file,print,about',
                      buttonsXS: 'paragraph,bold,strikethrough,underline,italic,|,superscript,subscript,|,ul,ol,|,align,outdent,indent,|,font,fontsize,brush,color,|,image,video,link,table,cut,hr,|,symbol,selectall,file,print,about',
                      events: {
                        afterInit: (editor: any) => {
                          console.log('Jodit 에디터 초기화 완료');
                        },
                      },
                      colorPickerDefaultTab: 'color' as const,
                      uploader: {
                        insertImageAsBase64URI: true,
                      },
                      filebrowser: {
                        ajax: {
                          url: '/api/upload',
                        },
                      },
                    }}
                    onBlur={(newContent: string) => setContent(newContent)}
                    onChange={(newContent: string) => {}}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 글 목록 */}
          {!isWriting && !viewingArticle && !isEditing && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              {/* 섹션 헤더 */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedCategory === '전체' ? '모든 글' : selectedCategory}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    총 {filteredArticles.length}개의 글이 있습니다
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="검색..."
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">데이터를 불러오는 중...</p>
                  </div>
                </div>
              ) : filteredArticles.length > 0 ? (
                <>
                  {/* 글 목록 그리드 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                    {filteredArticles.map((article) => {
                      // 미리보기 이미지는 데이터베이스에서 가져온 preview_image 사용
                      const previewImage = article.preview_image;
                      // API에서 제공하는 preview_text 사용, 없으면 기본 텍스트
                      const preview = article.preview_text || `${article.category} 관련 기술자료`;
                      // API에서 제공하는 preview_table 사용
                      const previewTable = article.preview_table;

                      return (
                        <div
                          key={article.id}
                          className="group bg-white border border-gray-200 rounded-lg min-h-[150px] hover:shadow-lg transition-all duration-200 cursor-pointer"
                          onClick={() => handleViewArticle(article)}
                        >
                          <div className="w-full h-48 bg-gray-100 flex items-center justify-center overflow-hidden relative">
                            {previewImage ? (
                              <Image
                                src={previewImage}
                                alt="미리보기 이미지"
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                style={{ objectFit: 'cover' }}
                                className="w-full h-full object-cover"
                              />
                            ) : previewTable ? (
                              <div
                                className="w-full h-full p-2"
                                dangerouslySetInnerHTML={{ __html: previewTable }}
                              />
                            ) : (
                                // 이미지가 없을 경우 기본 이미지 표시
                                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                              )}
                          </div>
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {article.category}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(article.created_at).toLocaleDateString('ko-KR')}
                              </span>
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors duration-200 line-clamp-2">
                              {article.title}
                            </h3>
                            <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                              {preview}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-blue-600 group-hover:text-blue-700 font-medium">
                                자세히 보기 →
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {selectedCategory === '전체' ? '등록된 글이 없습니다' : `${selectedCategory} 카테고리에 글이 없습니다`}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    첫 번째 기술자료를 작성해보세요.
                  </p>
                  <button
                    onClick={() => setIsWriting(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span>새 글 작성</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      
    </>
  );
}