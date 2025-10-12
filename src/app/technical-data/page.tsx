"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as ReactDOM from 'react-dom';

// React 19에서 findDOMNode 오류 해결을 위한 패치
if (typeof window !== 'undefined' && !(ReactDOM as any).findDOMNode) {
  (ReactDOM as any).findDOMNode = (node: any) => {
    if (node?.nodeType === 1) return node;
    if (node?.current?.nodeType === 1) return node.current;
    return null;
  };
}
import { createClient } from '@/utils/supabase/client';
import Layout from '@/components/layout/Layout';
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
import { koLang } from './jodit-ko';

// Jodit 에디터 타입 정의
declare global {
  interface Window {
    Jodit: any;
  }
}

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
  

  // Jodit 한국어 언어팩 등록
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Jodit) {
      (window as any).Jodit.lang.ko = koLang;
    }
  }, []);

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
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from('technical-data-images')
        .upload(fileName, file);

      if (error) {
        alert('이미지 업로드에 실패했습니다.');
        return;
      }

      // 업로드된 이미지의 공개 URL 가져오기
      const { data: { publicUrl } } = supabase.storage
        .from('technical-data-images')
        .getPublicUrl(fileName);

      // Jodit 에디터에 이미지 삽입
      if (joditInstance.current && joditInstance.current.value !== undefined) {
        const editor = joditInstance.current;
        editor.selection.insertHTML(`<img src="${publicUrl}" alt="업로드된 이미지" style="max-width: 100%; height: auto;" />`);
      }
    } catch (error) {
      console.error('Image upload error:', error);
      alert('이미지 업로드 중 오류가 발생했습니다.');
    }
  };

  // Jodit 에디터 참조
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const joditInstance = useRef<any>(null);

  // Jodit 에디터 초기화 - example 폴더 방식 적용
  useEffect(() => {
    // 에디터가 필요한 모드가 아니면 초기화하지 않음
    if (!isWriting && !isEditing) {
      return;
    }

    let mounted = true;

    const initJodit = async () => {
      try {
        // CDN에서 Jodit 로드 (example 폴더 방식)
        if (typeof window !== 'undefined' && !window.Jodit) {
          // CSS 로드
          const cssLink = document.createElement('link');
          cssLink.rel = 'stylesheet';
          cssLink.href = 'https://unpkg.com/jodit@4.6.13/es2021/jodit.min.css';
          document.head.appendChild(cssLink);

          // JS 로드
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/jodit@4.6.13/es2021/jodit.min.js';
          script.onload = () => {
            if (mounted) {
              initEditor();
            }
          };
          document.head.appendChild(script);
        } else if (typeof window !== 'undefined' && window.Jodit) {
          initEditor();
        }
      } catch (error) {
        console.error('Jodit 로드 실패:', error);
      }
    };

    const initEditor = () => {
      if (!textareaRef.current || !window.Jodit) return;

      try {
        // 기존 에디터 정리
        if (joditInstance.current) {
          try {
            joditInstance.current.destruct();
          } catch (error) {
            console.error('기존 에디터 정리 실패:', error);
          }
        }

        // 한국어 언어팩 등록
        if (koLang) {
          window.Jodit.lang.ko = koLang;
        }

        // 참고용 폴더의 완전한 설정을 적용
        const config = {
          language: 'ko',
          height: 800,
          placeholder: '내용을 입력해주세요.',
          toolbar: true,
          toolbarAdaptive: true,
          showTooltip: true,
          showTooltipDelay: 200,
          statusbar: true,
          showCharsCounter: true,
          showWordsCounter: true,
          showXPathInStatusbar: false,
          
          // 깔끔한 툴바 설정 - 중복 제거
          buttons: [
            'bold', 'italic', 'underline', 'strikethrough', '|',
            'superscript', 'subscript', '|',
            'ul', 'ol', 'outdent', 'indent', '|',
            'font', 'fontsize', 'lineHeight', '|',
            'brush', 'align', 'paragraph', '|',
            'image', 'video', 'file', 'table', 'link', 'hr', 'symbols', '|',
            'cut', 'copy', 'paste', 'selectall', '|',
            'undo', 'redo', '|',
            'find', 'source', '|',
            'eraser', 'copyformat', 'fullsize', 'preview', 'print', 'spellcheck', '|',
            'about'
          ],
          // 업로더 설정
          uploader: {
            insertImageAsBase64URI: true,
            imagesExtensions: ['jpg', 'png', 'jpeg', 'gif', 'svg', 'webp'],
            filesVariableName: function(t: number) {
              return 'files[' + t + ']';
            },
            withCredentials: false,
            pathVariableName: 'path',
            format: 'json',
            method: 'POST'
          },

          // 파일 브라우저 설정
          filebrowser: {
            ajax: {
              url: '/api/files'
            }
          },

          // 이미지 설정
          image: {
            openOnDblClick: true,
            editSrc: true,
            editStyle: true,
            editAlt: true,
            editTitle: true,
            editMargins: true,
            editClass: true,
            editId: true,
            editAlign: true,
            editSize: true,
            useImageEditor: true
          },

          // 링크 설정
          link: {
            followOnDblClick: false,
            processVideoLink: true,
            processPastedLink: true,
            openLinkDialogAfterPost: true,
            removeLinkAfterFormat: true,
            noFollowCheckbox: true,
            openInNewTabCheckbox: true
          },

          // 테이블 설정
          table: {
            selectionCellStyle: 'border: 1px double #1e88e5 !important;',
            useExtraClassesOptions: false
          },

          // 색상 설정
          colors: {
            greyscale: [
              '#000000', '#434343', '#666666', '#999999', '#B7B7B7',
              '#CCCCCC', '#D9D9D9', '#EFEFEF', '#F3F3F3', '#FFFFFF'
            ],
            palette: [
              '#980000', '#FF0000', '#FF9900', '#FFFF00', '#00F0F0',
              '#00FFFF', '#4A86E8', '#0000FF', '#9900FF', '#FF00FF'
            ],
            full: [
              '#E6B8AF', '#F4CCCC', '#FCE5CD', '#FFF2CC', '#D9EAD3',
              '#D0E0E3', '#C9DAF8', '#CFE2F3', '#D9D2E9', '#EAD1DC',
              '#DD7E6B', '#EA9999', '#F9CB9C', '#FFE599', '#B6D7A8',
              '#A2C4C9', '#A4C2F4', '#9FC5E8', '#B4A7D6', '#D5A6BD'
            ]
          },

          // 폰트 설정
          controls: {
            font: {
              list: {
                'Arial': 'Arial, Helvetica, sans-serif',
                'Arial Black': 'Arial Black, Gadget, sans-serif',
                'Comic Sans MS': 'Comic Sans MS, cursive',
                'Courier New': 'Courier New, Courier, monospace',
                'Georgia': 'Georgia, serif',
                'Impact': 'Impact, Charcoal, sans-serif',
                'Lucida Console': 'Lucida Console, Monaco, monospace',
                'Lucida Sans Unicode': 'Lucida Sans Unicode, Lucida Grande, sans-serif',
                'Palatino Linotype': 'Palatino Linotype, Book Antiqua, Palatino, serif',
                'Tahoma': 'Tahoma, Geneva, sans-serif',
                'Times New Roman': 'Times New Roman, Times, serif',
                'Trebuchet MS': 'Trebuchet MS, Helvetica, sans-serif',
                'Verdana': 'Verdana, Geneva, sans-serif',
                '맑은 고딕': 'Malgun Gothic, sans-serif',
                '나눔고딕': 'Nanum Gothic, sans-serif',
                '돋움': 'Dotum, sans-serif',
                '굴림': 'Gulim, sans-serif'
              }
            },
            fontsize: {
              list: [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72]
            }
          },

          // 기타 설정
          enter: 'p',
          defaultActionOnPaste: 'insert_as_html',
          askBeforePasteHTML: false,
          askBeforePasteFromWord: false,
          defaultMode: 1, // WYSIWYG 모드
          useSplitMode: false,
          editHTMLDocumentMode: false,
          iframe: false,
          iframeStyle: '',
          iframeCSSLinks: [],
          
          // 플러그인 설정 - 모든 기본 플러그인 활성화
          disablePlugins: [], // 비활성화할 플러그인 없음
          extraPlugins: [], // 추가 플러그인 없음
          
          // 모든 기본 플러그인 명시적 활성화
          safePluginsList: [
            'about', 'add-new-line', 'backspace', 'delete', 'bold', 'class-span',
            'clean-html', 'clipboard', 'color', 'copy-format', 'drag-and-drop',
            'drag-and-drop-element', 'enter', 'file', 'focus', 'font', 'format-block',
            'fullsize', 'hotkeys', 'hr', 'iframe', 'image', 'image-processor',
            'image-properties', 'indent', 'inline-popup', 'justify', 'key-arrow-outside',
            'limit', 'line-height', 'link', 'media', 'mobile', 'ordered-list',
            'paste', 'paste-from-word', 'paste-storage', 'placeholder', 'powered-by-jodit',
            'preview', 'print', 'redo-undo', 'resize-cells', 'resize-handler',
            'resizer', 'search', 'select', 'select-cells', 'size', 'source',
            'spellcheck', 'stat', 'sticky', 'symbols', 'ai-assistant', 'tab',
            'table', 'table-keyboard-navigation', 'video', 'wrap-nodes', 'dtd', 'xpath'
          ],
          
          // 이벤트 설정
          events: {
            afterInit: function() {
              console.log('Jodit 에디터가 완전히 초기화되었습니다.');
              console.log('활성화된 플러그인:', (this as any).plugins);
            },
            beforeDestruct: function() {
              console.log('Jodit 에디터가 종료됩니다.');
            }
          }
        };

        // example 폴더와 동일한 방식으로 에디터 생성
        joditInstance.current = window.Jodit.make(textareaRef.current, config);
        
        if (joditInstance.current) {
          // 이벤트 리스너 등록
          joditInstance.current.events.on('change', (value: string) => {
            setContent(value);
          });

          joditInstance.current.events.on('afterInit', () => {
            console.log('Jodit 에디터 초기화 완료');
            // 초기 내용 설정
            if (content) {
              joditInstance.current.value = content;
            }
          });
        }
      } catch (error) {
        console.error('Jodit 에디터 초기화 실패:', error);
      }
    };

    initJodit();

    return () => {
      mounted = false;
      if (joditInstance.current && joditInstance.current.destruct) {
        try {
          joditInstance.current.destruct();
          joditInstance.current = null;
        } catch (error) {
          console.error('Jodit 에디터 정리 실패:', error);
        }
      }
    };
  }, [isWriting, isEditing]);

  // 콘텐츠 변경 시 에디터 업데이트
  useEffect(() => {
    if (joditInstance.current && joditInstance.current.value !== content) {
      joditInstance.current.value = content;
    }
  }, [content]);

  // 편집 모드 전환 시 에디터 내용 동기화
  useEffect(() => {
    if (isEditing && editingArticle && joditInstance.current) {
      // 편집할 글의 내용을 에디터에 설정
      setTimeout(() => {
        if (joditInstance.current) {
          joditInstance.current.value = editingArticle.content;
        }
      }, 100); // 에디터 초기화 완료 후 내용 설정
    }
  }, [isEditing, editingArticle]);

  // 글 목록 가져오기 (최적화: 목록에 필요한 필드만 선택)
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setIsLoading(true);
        const supabase = createClient();
        
        // 목록 화면에서는 필요한 필드만 가져오기
        const { data, error } = await supabase
          .from('technical_articles')
          .select('id, title, category, created_at, updated_at, tags, content')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching articles:', error);
          return;
        }

        // content에서 첫 번째 이미지 URL을 추출하고 content는 빈 문자열로 설정
        const articlesWithEmptyContent = (data || []).map((article: any) => {
          // 첫 번째 이미지 URL 추출
          const imgMatch = article.content?.match(/<img[^>]+src="([^"]+)"/i);
          const preview_image = imgMatch ? imgMatch[1] : null;
          
          return {
            ...article,
            content: '', // 목록에서는 빈 문자열로 설정
            preview_image // 첫 번째 이미지 URL
          };
        });

        setArticles(articlesWithEmptyContent);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticles();
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
    if (!title.trim() || !content.trim()) {
      toast.error('제목과 내용을 모두 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
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
        console.error('Error saving article:', error);
        toast.error('글 저장에 실패했습니다.');
        return;
      }

      alert('새 글이 성공적으로 저장되었습니다!');
      setArticles([...articles, data[0]]);
      setIsWriting(false);
      setTitle('');
      setContent('');
      setCategory('기계/배관');
    } catch (error) {
      console.error('Error:', error);
      alert('글 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 글 수정 시작 (상세 내용 로딩 포함)
  const handleEdit = async (article: Article) => {
    // 이미 content가 있으면 바로 편집 모드로
    if (article.content) {
      setEditingArticle(article);
      setTitle(article.title);
      setContent(article.content);
      setCategory(article.category);
      setIsEditing(true);
      setViewingArticle(null); // 읽기 모드 숨기기
      return;
    }

    // content가 없으면 상세 내용 가져오기
    const content = await fetchArticleDetail(article.id);
    if (content) {
      const articleWithContent = { ...article, content };
      setEditingArticle(articleWithContent);
      setTitle(articleWithContent.title);
      setContent(articleWithContent.content);
      setCategory(articleWithContent.category);
      setIsEditing(true);
      setViewingArticle(null); // 읽기 모드 숨기기
      
      // articles 배열도 업데이트
      setArticles(articles.map(a => a.id === article.id ? articleWithContent : a));
    }
  };

  // 글 수정 저장
  const handleUpdate = async () => {
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('technical_articles')
        .update({
          title: title.trim(),
          content: content.trim(),
          category: category,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingArticle!.id)
        .select();

      if (error) {
        console.error('Error updating article:', error);
        alert('글 수정에 실패했습니다.');
        return;
      }

      alert('글이 성공적으로 수정되었습니다!');
      setArticles(articles.map(article => article.id === editingArticle!.id ? data[0] : article));
      setIsEditing(false);
      setEditingArticle(null);
      setTitle('');
      setContent('');
      setCategory('기계/배관');
    } catch (error) {
      console.error('Error:', error);
      alert('글 수정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 글 삭제
  const handleDelete = async (articleId: string) => {
    if (!confirm('정말로 이 글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('technical_articles')
        .delete()
        .eq('id', articleId);

      if (error) {
        console.error('Error deleting article:', error);
        alert('글 삭제에 실패했습니다.');
        return;
      }

      alert('글이 성공적으로 삭제되었습니다!');
      setArticles(articles.filter(article => article.id !== articleId));
      setViewingArticle(null);
    } catch (error) {
      console.error('Error:', error);
      alert('글 삭제 중 오류가 발생했습니다.');
    }
  };

  // 글 상세 내용 가져오기 (최적화: 필요할 때만 content 로딩)
  const fetchArticleDetail = async (articleId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('technical_articles')
        .select('content')
        .eq('id', articleId)
        .single();

      if (error) {
        console.error('Error fetching article detail:', error);
        return null;
      }

      return data.content;
    } catch (error) {
      console.error('Error:', error);
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
      <Layout title="기술자료">
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
                      onClick={() => handleEdit(viewingArticle)}
                      className="flex items-center gap-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 text-sm"
                    >
                      <PencilIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">수정</span>
                    </button>
                    <button
                      onClick={() => handleDelete(viewingArticle.id)}
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
                  <textarea 
                    ref={textareaRef} 
                    id="jodit-editor"
                    className="min-h-[400px] w-full"
                    defaultValue={content}
                    title="기술 자료 내용 입력"
                    placeholder="내용을 입력해주세요."
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
                  <textarea 
                    ref={textareaRef} 
                    id="jodit-editor-write"
                    placeholder="내용을 입력해주세요."
                    title="글 내용 입력"
                    className="min-h-[400px] w-full"
                    defaultValue={content}
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
                      // 목록에서는 간단한 미리보기 텍스트 표시
                      const preview = `${article.category} 관련 기술자료`;

                      // article.content에서 테이블 미리보기 추출
                      let previewTable: string | undefined;
                      if (!previewImage && article.content) {
                        try {
                          const parser = new window.DOMParser();
                          const doc = parser.parseFromString(article.content, 'text/html');
                          const table = doc.querySelector('table'); // 누락된 table 변수 선언 추가
                          if (table) {
                            previewTable = table.outerHTML;
                          }
                        } catch (error) {
                          console.error('Error parsing article content for table preview:', error);
                        }
                      }

                      return (
                        <div
                          key={article.id}
                          className="group bg-white border border-gray-200 rounded-lg min-h-[150px] hover:shadow-lg transition-all duration-200 cursor-pointer"
                          onClick={() => handleViewArticle(article)}
                        >
                          <div className="w-full h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                            {previewImage ? (
                              <img src={previewImage} alt="미리보기 이미지" className="w-full h-full object-cover" />
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
      </Layout>
    </>
  );
}