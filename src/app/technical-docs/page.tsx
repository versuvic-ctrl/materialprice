'use client';

import React,
{ useState, useMemo, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronRightIcon, DocumentPlusIcon, MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

// --- Supabase 클라이언트 및 타입 정의 (변경 없음) ---
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
interface Article { id: string; created_at: string; title: string; category: string; content: string; tags: string[]; }

// --- 데이터 페칭 및 뮤테이션 훅 (변경 없음) ---
const useArticles = () => useQuery<Article[]>({ queryKey: ['articles'], queryFn: async () => { const { data, error } = await supabase.from('technical_articles').select('*').order('category').order('title'); if (error) throw new Error(error?.message || error?.toString() || '알 수 없는 오류'); return data; }, });
const useCreateArticle = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: async (newArticle: Omit<Article, 'id' | 'created_at'>) => { const { error } = await supabase.from('technical_articles').insert(newArticle); if (error) throw new Error(error?.message || error?.toString() || '알 수 없는 오류'); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['articles'] }); }, }); };
const useUpdateArticle = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: async (updatedArticle: Partial<Article> & { id: string }) => { const { error } = await supabase.from('technical_articles').update(updatedArticle).eq('id', updatedArticle.id); if (error) throw new Error(error?.message || error?.toString() || '알 수 없는 오류'); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['articles'] }); }, }); };
const useDeleteArticle = () => { const queryClient = useQueryClient(); return useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from('technical_articles').delete().eq('id', id); if (error) throw new Error(error?.message || error?.toString() || '알 수 없는 오류'); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['articles'] }); }, }); };

// --- 메인 컴포넌트 ---
export default function TechnicalDocsPage() {
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>('view');
  const [searchTerm, setSearchTerm] = useState('');
  const [editorState, setEditorState] = useState({ title: '', category: '', tags: '', content: '' });

  const { data: articles, isLoading } = useArticles();
  const createArticle = useCreateArticle();
  const updateArticle = useUpdateArticle();
  const deleteArticle = useDeleteArticle();

  useEffect(() => {
    if (articles && articles.length > 0 && !selectedArticleId) {
      setSelectedArticleId(articles[0].id);
    }
  }, [articles, selectedArticleId]);

  const filteredArticlesByCategory = useMemo(() => {
    if (!articles) return {};
    const filtered = articles.filter(article =>
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return filtered.reduce((acc, article) => {
      (acc[article.category] = acc[article.category] || []).push(article);
      return acc;
    }, {} as Record<string, Article[]>);
  }, [articles, searchTerm]);

  const selectedArticle = useMemo(() => articles?.find(article => article.id === selectedArticleId), [articles, selectedArticleId]);

  const handlePasswordSubmit = () => {
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setIsPasswordModalOpen(false);
      setPassword('');
      // 관리자 모드 진입 시 글쓰기 모드로 전환
      setMode('create');
      setEditorState({ title: '', category: '', tags: '', content: '' });
      setSelectedArticleId(null);
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  const handleEditClick = () => {
    if (selectedArticle) {
      setMode('edit');
      setEditorState({
        title: selectedArticle.title,
        category: selectedArticle.category,
        tags: selectedArticle.tags.join(', '),
        content: selectedArticle.content,
      });
    }
  };
  
  const handleDelete = (id: string) => {
    if (window.confirm('정말로 이 문서를 삭제하시겠습니까?')) {
      deleteArticle.mutate(id, {
        onSuccess: () => {
          setSelectedArticleId(null);
          setMode('view');
        }
      });
    }
  };

  const handleEditorSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = {
      title: editorState.title,
      category: editorState.category,
      content: editorState.content,
      tags: editorState.tags.split(',').map(tag => tag.trim()).filter(Boolean),
    };

    const action = mode === 'create'
      ? createArticle.mutateAsync(data)
      : updateArticle.mutateAsync({ ...data, id: selectedArticle!.id });

    action.then(() => {
      setMode('view');
      // 글 생성/수정 후 해당 글로 포커스 (나중에 구현)
    });
  };

  return (
    <Layout title="기술 자료">
      <div className="flex h-full min-h-[calc(100vh-200px)] gap-8">
        {/* Left Sidebar */}
        <aside className="w-1/4 min-w-[300px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">자료 목록</h2>
            {isAuthenticated ? (
               <Button size="sm" onClick={() => { setMode('create'); setSelectedArticleId(null); setEditorState({ title: '', category: '', tags: '', content: '' }); }}>
                <DocumentPlusIcon className="h-4 w-4 mr-2" /> 새 글 작성
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setIsPasswordModalOpen(true)}>
                <LockClosedIcon className="h-4 w-4 mr-2" /> 관리
              </Button>
            )}
          </div>
          <div className="relative mb-4">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="검색..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex-grow overflow-y-auto pr-2">
            {isLoading ? <p className="text-gray-500">로딩 중...</p> :
              Object.entries(filteredArticlesByCategory).map(([category, articlesInCategory]) => (
                <div key={category} className="mb-4">
                  <h3 className="font-semibold text-gray-800 mb-2">{category}</h3>
                  <ul className="space-y-1">
                    {articlesInCategory.map(article => (
                      <li key={article.id}>
                        <button
                          onClick={() => { setSelectedArticleId(article.id); setMode('view'); }}
                          className={`w-full text-left p-2 rounded-md text-sm transition-colors ${selectedArticleId === article.id ? 'bg-blue-100 text-blue-800 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                          {article.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            }
          </div>
        </aside>

        {/* Right Content */}
        <main className="w-3/4">
          {mode === 'view' && (
            selectedArticle ? (
              <div className="animate-fade-in bg-white rounded-lg shadow-sm border">
                {/* 네이버 블로그 스타일 헤더 */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 px-6 py-4 border-b">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <span className="inline-block px-3 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full mb-2">
                        {selectedArticle.category}
                      </span>
                      <h1 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">
                        {selectedArticle.title}
                      </h1>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{new Date(selectedArticle.created_at).toLocaleDateString('ko-KR')}</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedArticle.tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 text-xs bg-white/70 text-gray-600 rounded border">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {isAuthenticated && (
                      <div className="flex gap-2 ml-4">
                        <Button size="sm" variant="outline" onClick={handleEditClick}>
                          <PencilSquareIcon className="h-4 w-4 mr-1" />
                          수정
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(selectedArticle.id)}>
                          <TrashIcon className="h-4 w-4 mr-1" />
                          삭제
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* 네이버 블로그 스타일 본문 */}
                <div className="px-6 py-6">
                  <article className="prose prose-lg max-w-none">
                    <div className="blog-content">
                      {selectedArticle.content.split('\n').map((line, index) => {
                        if (line.trim() === '') {
                          return <br key={index} />;
                        }
                        
                        // 마크다운 헤더 처리
                        if (line.startsWith('### ')) {
                          return <h3 key={index} className="text-lg font-semibold mt-6 mb-3 text-gray-800">{line.replace('### ', '')}</h3>;
                        }
                        if (line.startsWith('## ')) {
                          return <h2 key={index} className="text-xl font-bold mt-8 mb-4 text-gray-900">{line.replace('## ', '')}</h2>;
                        }
                        if (line.startsWith('# ')) {
                          return <h1 key={index} className="text-2xl font-bold mt-8 mb-4 text-gray-900">{line.replace('# ', '')}</h1>;
                        }
                        
                        // 리스트 처리
                        if (line.startsWith('- ') || line.startsWith('* ')) {
                          return (
                            <div key={index} className="flex items-start mb-2">
                              <span className="text-green-500 mr-2 mt-1">•</span>
                              <span className="text-gray-700 leading-relaxed">{line.replace(/^[\-\*] /, '')}</span>
                            </div>
                          );
                        }
                        
                        // 번호 리스트 처리
                        const numberMatch = line.match(/^(\d+)\. (.*)/);
                        if (numberMatch) {
                          return (
                            <div key={index} className="flex items-start mb-2">
                              <span className="text-blue-500 font-medium mr-2 mt-1">{numberMatch[1]}.</span>
                              <span className="text-gray-700 leading-relaxed">{numberMatch[2]}</span>
                            </div>
                          );
                        }
                        
                        // 코드 블록 처리
                        if (line.startsWith('```')) {
                          return <div key={index} className="bg-gray-100 rounded p-3 my-3 font-mono text-sm border-l-4 border-blue-400">{line.replace(/```/g, '')}</div>;
                        }
                        
                        // 인용문 처리
                        if (line.startsWith('> ')) {
                          return (
                            <blockquote key={index} className="border-l-4 border-green-400 pl-4 py-2 my-3 bg-green-50 italic text-gray-700">
                              {line.replace('> ', '')}
                            </blockquote>
                          );
                        }
                        
                        // 일반 텍스트
                        return (
                          <p key={index} className="text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap">
                            {line}
                          </p>
                        );
                      })}
                    </div>
                  </article>
                </div>
                
                {/* 네이버 블로그 스타일 푸터 */}
                <div className="px-6 py-4 bg-gray-50 border-t">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                      마지막 수정: {new Date(selectedArticle.created_at).toLocaleDateString('ko-KR')}
                    </div>
                    {isAuthenticated && (
                      <Button size="sm" variant="outline" onClick={handleEditClick}>
                        <PencilSquareIcon className="h-4 w-4 mr-1" />
                        이 글 수정하기
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 bg-white rounded-lg shadow-sm border">
                <div className="p-12">
                  <h2 className="text-3xl font-bold text-gray-800 mb-4">📚 기술 블로그</h2>
                  <p className="text-lg text-gray-600 mb-6">개발 지식과 경험을 공유하는 공간입니다</p>
                  <p className="text-gray-500">왼쪽 목록에서 글을 선택하거나, 검색을 통해 원하는 내용을 찾아보세요.</p>
                  {isAuthenticated && (
                    <Button className="mt-6" onClick={() => { setMode('create'); setSelectedArticleId(null); setEditorState({ title: '', category: '', tags: '', content: '' }); }}>
                      <DocumentPlusIcon className="h-4 w-4 mr-2" />
                      새 글 작성하기
                    </Button>
                  )}
                </div>
              </div>
            )
          )}

          {(mode === 'create' || mode === 'edit') && isAuthenticated && (
            <div className="animate-fade-in bg-white rounded-lg shadow-sm border">
              {/* 네이버 블로그 스타일 에디터 헤더 */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {mode === 'create' ? '✍️ 새 글 작성' : '📝 글 수정'}
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {mode === 'create' ? '새로운 기술 블로그 글을 작성해보세요' : '기존 글을 수정하고 있습니다'}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setMode('view')}>
                    ← 목록으로
                  </Button>
                </div>
              </div>
              
              <div className="p-6">
                <form onSubmit={handleEditorSubmit} className="space-y-6">
                  {/* 기본 정보 입력 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="title" className="block text-sm font-semibold text-gray-700">
                        📝 제목 *
                      </label>
                      <Input 
                        id="title" 
                        value={editorState.title} 
                        onChange={e => setEditorState({...editorState, title: e.target.value})} 
                        placeholder="글 제목을 입력하세요"
                        className="text-lg font-medium"
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="category" className="block text-sm font-semibold text-gray-700">
                        📂 카테고리 *
                      </label>
                      <Input 
                        id="category" 
                        value={editorState.category} 
                        onChange={e => setEditorState({...editorState, category: e.target.value})} 
                        placeholder="예: React, JavaScript, Backend"
                        required 
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="tags" className="block text-sm font-semibold text-gray-700">
                      🏷️ 태그
                    </label>
                    <Input 
                      id="tags" 
                      value={editorState.tags} 
                      onChange={e => setEditorState({...editorState, tags: e.target.value})} 
                      placeholder="태그를 쉼표로 구분해서 입력하세요 (예: react, hooks, tutorial)"
                    />
                  </div>
                  
                  {/* 본문 작성 영역 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 에디터 */}
                    <div className="space-y-2">
                      <label htmlFor="content" className="block text-sm font-semibold text-gray-700">
                        ✏️ 본문 작성
                      </label>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 border-b text-xs text-gray-600">
                           💡 마크다운 문법을 사용할 수 있습니다 (# 제목, - 리스트, &gt; 인용문 등)
                         </div>
                        <Textarea 
                          id="content" 
                          value={editorState.content} 
                          onChange={e => setEditorState({...editorState, content: e.target.value})} 
                          rows={20} 
                          className="border-0 resize-none focus:ring-0 font-mono text-sm leading-relaxed"
                          placeholder={`글 내용을 입력하세요...

예시:
# 제목
## 소제목
### 작은 제목

일반 텍스트입니다.

- 리스트 항목 1
- 리스트 항목 2

1. 번호 리스트
2. 번호 리스트

인용문입니다

javascript
코드 블록`}
                        />
                      </div>
                    </div>
                    
                    {/* 미리보기 */}
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">
                        👀 실시간 미리보기
                      </label>
                      <div className="border rounded-lg h-[500px] overflow-y-auto bg-white">
                        <div className="bg-gray-50 px-3 py-2 border-b text-xs text-gray-600">
                          📖 작성한 내용이 어떻게 보일지 확인하세요
                        </div>
                        <div className="p-4">
                          {editorState.content ? (
                            <div className="blog-content">
                              {editorState.content.split('\n').map((line, index) => {
                                if (line.trim() === '') {
                                  return <br key={index} />;
                                }
                                
                                // 마크다운 헤더 처리
                                if (line.startsWith('### ')) {
                                  return <h3 key={index} className="text-lg font-semibold mt-4 mb-2 text-gray-800">{line.replace('### ', '')}</h3>;
                                }
                                if (line.startsWith('## ')) {
                                  return <h2 key={index} className="text-xl font-bold mt-6 mb-3 text-gray-900">{line.replace('## ', '')}</h2>;
                                }
                                if (line.startsWith('# ')) {
                                  return <h1 key={index} className="text-2xl font-bold mt-6 mb-3 text-gray-900">{line.replace('# ', '')}</h1>;
                                }
                                
                                // 리스트 처리
                                if (line.startsWith('- ') || line.startsWith('* ')) {
                                  return (
                                    <div key={index} className="flex items-start mb-1">
                                      <span className="text-green-500 mr-2 mt-1">•</span>
                                      <span className="text-gray-700 leading-relaxed">{line.replace(/^[\-\*] /, '')}</span>
                                    </div>
                                  );
                                }
                                
                                // 번호 리스트 처리
                                const numberMatch = line.match(/^(\d+)\. (.*)/);
                                if (numberMatch) {
                                  return (
                                    <div key={index} className="flex items-start mb-1">
                                      <span className="text-blue-500 font-medium mr-2 mt-1">{numberMatch[1]}.</span>
                                      <span className="text-gray-700 leading-relaxed">{numberMatch[2]}</span>
                                    </div>
                                  );
                                }
                                
                                // 코드 블록 처리
                                if (line.startsWith('```')) {
                                  return <div key={index} className="bg-gray-100 rounded p-2 my-2 font-mono text-sm border-l-4 border-blue-400">{line.replace(/```/g, '')}</div>;
                                }
                                
                                // 인용문 처리
                                if (line.startsWith('> ')) {
                                  return (
                                    <blockquote key={index} className="border-l-4 border-green-400 pl-3 py-1 my-2 bg-green-50 italic text-gray-700">
                                      {line.replace('> ', '')}
                                    </blockquote>
                                  );
                                }
                                
                                // 일반 텍스트
                                return (
                                  <p key={index} className="text-gray-700 leading-relaxed mb-2 whitespace-pre-wrap">
                                    {line}
                                  </p>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center text-gray-400 mt-8">
                              <p>✍️ 내용을 입력하면 여기에 미리보기가 표시됩니다</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 액션 버튼 */}
                  <div className="flex justify-between items-center pt-6 border-t">
                    <div className="flex gap-2">
                      {mode === 'edit' && selectedArticle && (
                        <Button type="button" variant="destructive" onClick={() => handleDelete(selectedArticle.id)}>
                          <TrashIcon className="h-4 w-4 mr-1" />
                          삭제
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setMode('view')}>
                        취소
                      </Button>
                      <Button type="submit" className="bg-green-600 hover:bg-green-700">
                        {mode === 'create' ? '📝 글 발행' : '💾 수정 완료'}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Password Modal */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>관리자 인증</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordModalOpen(false)}>취소</Button>
            <Button onClick={handlePasswordSubmit}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}