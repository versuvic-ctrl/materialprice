'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/layout/Layout';
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor';
import { createClient } from '@/utils/supabase/client';

// 전역 Supabase 클라이언트 인스턴스
let globalSupabaseClient: any = null;

interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  images?: string[]; // 이미지 URL 배열 추가
}

const TechnicalDataPage: React.FC = () => {
  // 전역 클라이언트 초기화 (한 번만 생성)
  if (!globalSupabaseClient) {
    globalSupabaseClient = createClient();
  }
  const supabase = globalSupabaseClient;

  // HTML 태그를 제거하고 텍스트만 추출하는 함수
  const stripHtmlTags = (html: string): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  };
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [showPasswordInput, setShowPasswordInput] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isCreatingNewPost, setIsCreatingNewPost] = useState<boolean>(false);
  const [articles, setArticles] = useState<Article[]>([]); // Supabase에서 가져올 글 목록 상태
  const [session, setSession] = useState<any>(null); // Supabase 세션 상태

  const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

  const [newPostTitle, setNewPostTitle] = useState<string>('');

  // Supabase 클라이언트 초기화 및 세션 추적
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // fetchArticles 함수를 useEffect 밖으로 이동하여 재사용 가능하게 합니다.
  const fetchArticles = async () => {
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, content, category, images'); // images 컬럼 추가

    if (error) {
      console.error('Error fetching articles:', error);
    } else {
      setArticles(data || []);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  useEffect(() => {
    const performAdminLogin = async () => {
      console.log('=== 관리자 로그인 시도 ===');
      console.log('입력된 비밀번호:', password);
      console.log('설정된 관리자 비밀번호:', adminPassword);
      console.log('비밀번호 일치 여부:', password === adminPassword);
      console.log('관리자 이메일:', process.env.NEXT_PUBLIC_ADMIN_EMAIL);
      
      if (password === adminPassword) {
        // 실제 관리자 계정의 이메일과 비밀번호를 사용해야 합니다.
        // 이 부분은 실제 배포 시 환경 변수 등으로 관리되어야 합니다.
        console.log('Supabase 로그인 시도 중...');
        const { data, error } = await supabase.auth.signInWithPassword({
          email: process.env.NEXT_PUBLIC_ADMIN_EMAIL!, // 실제 관리자 이메일로 변경 필요
          password: '0486', // 실제 Supabase 계정 비밀번호 사용
        });

        console.log('Supabase 로그인 응답 데이터:', data);
        console.log('Supabase 로그인 오류:', error);

        if (error) {
          console.error('Supabase admin login error:', error);
          console.error('Error code:', error.message);
          alert(`관리자 로그인에 실패했습니다: ${error.message}`);
        } else {
          console.log('Supabase 로그인 성공!');
          setIsAdmin(true);
          setShowPasswordInput(false);
          
          // 로그인 성공 후 세션 확인
          setTimeout(async () => {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            console.log('로그인 후 세션 확인:', session);
            console.log('로그인 후 세션 오류:', sessionError);
            
            if (session) {
              console.log('세션 액세스 토큰:', session.access_token ? '존재함' : '없음');
              const { data: { user } } = await supabase.auth.getUser();
              console.log('로그인된 사용자:', user);
              console.log('사용자 역할:', user?.role);
            } else {
              console.error('로그인 성공했지만 세션이 없습니다!');
            }
          }, 1000); // 1초 후 세션 확인
        }
      } else if (password !== '' && showPasswordInput) {
        console.log('비밀번호 불일치');
        alert('비밀번호가 틀렸습니다.');
      }
    };

    // Only run the login/alert logic if password is not empty and the input is shown.
    // This prevents running on initial render or when password is intentionally cleared.
    if (password !== '' && showPasswordInput) {
      performAdminLogin();
    }
  }, [password, adminPassword, showPasswordInput]);

  const handleLogin = () => {
    setShowPasswordInput(true);
  };



  const categories = ['전체', '기계/배관', '전기/계기', '법규/규격', '기타'];

  const handleNewPostSave = async (title: string, content: string, imageUrls: string[] = []) => {
    console.log('=== 새 글 저장 시작 ===');
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('세션 정보:', session);
    console.log('세션 오류:', sessionError);
    console.log('isAdmin 상태:', isAdmin);
    
    if (session) {
      console.log('사용자 ID:', session.user?.id);
      console.log('사용자 이메일:', session.user?.email);
      console.log('액세스 토큰:', session.access_token ? '존재함' : '없음');
    }

    // 세션이 없고 관리자 상태인 경우 재로그인 시도
    if (!session && isAdmin) {
      console.log('세션이 없어서 재로그인 시도 중...');
      
      // 새로운 Supabase 클라이언트 생성
      const freshSupabase = createClient();
      
      const { data: loginData, error: loginError } = await freshSupabase.auth.signInWithPassword({
        email: process.env.NEXT_PUBLIC_ADMIN_EMAIL!,
        password: '0486',
      });
      
      console.log('재로그인 결과:', loginData);
      console.log('재로그인 오류:', loginError);
      
      if (loginError) {
        alert(`재로그인에 실패했습니다: ${loginError.message}`);
        return;
      }
      
      // 재로그인 후 세션 다시 확인
      const { data: { session: newSession } } = await freshSupabase.auth.getSession();
      console.log('재로그인 후 세션:', newSession);
      
      if (!newSession) {
        alert('재로그인 후에도 세션을 가져올 수 없습니다.');
        return;
      }
      
      setSession(newSession);
      
      // 전역 클라이언트를 새로운 클라이언트로 업데이트
      globalSupabaseClient = freshSupabase;
    } else if (!isAdmin && !session) {
      alert('로그인이 필요합니다. 관리자 비밀번호를 입력해주세요.');
      return;
    }

    const newArticle = {
      title: title,
      category: selectedCategory === '전체' ? '기타' : selectedCategory,
      content: content,
      images: imageUrls, // 이미지 URL 배열 추가
    };

    console.log('저장할 글 데이터:', newArticle);
    console.log('사용 중인 Supabase 클라이언트:', supabase);
    console.log('현재 세션 상태:', session);

    try {
      const { data, error } = await supabase
        .from('articles')
        .insert([newArticle]);

      console.log('Supabase 응답 데이터:', data);
      console.log('Supabase 오류:', error);

      if (error) {
        console.error('Supabase error:', error);
        console.error('Error details:', error.details);
        console.error('Error code:', error.code);
        console.error('Error hint:', error.hint);
        alert(`새 글 저장에 실패했습니다: ${error.message}`);
      } else {
        alert('새 글이 성공적으로 저장되었습니다!');
        setIsCreatingNewPost(false);
        setNewPostTitle(''); // 제목 초기화
        fetchArticles(); // 글 목록 새로고침
      }
    } catch (e) {
      console.error('Exception saving new post:', e);
      alert('새 글 저장 중 오류가 발생했습니다.');
    }
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `public/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('article_images')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      throw new Error('이미지 업로드에 실패했습니다.');
    }

    const { data } = supabase.storage
      .from('article_images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };



  const filteredArticles = selectedCategory === '전체'
    ? articles
    : articles.filter((article) => article.category === selectedCategory);

  return (
    <Layout title="기술자료">
      <div className="p-4">
        {/* 카테고리 목록 */}
        {!isCreatingNewPost && (
          <div className="mb-4">
            <ul className="flex space-x-4 justify-between items-center">
              <div className="flex space-x-4">
                {categories.map((category) => (
                  <li key={category}>
                    <button
                      className={`px-4 py-2 rounded-md ${selectedCategory === category ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                      onClick={() => {
                        setSelectedCategory(category);
                        setSelectedArticle(null); // 카테고리 변경 시 선택된 글 초기화
                      }}
                    >
                      {category}
                    </button>
                  </li>
                ))}
              </div>
              {/* 새글작성 버튼을 ul 내부 오른쪽에 배치 */}
              {!isAdmin && (
                <li>
                  <button
                    onClick={() => setIsCreatingNewPost(true)}
                    className="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600"
                  >
                    새 글 작성
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* 글 목록 또는 상세 보기 */}
        {selectedArticle ? (
          <div className="mb-4 border p-4 rounded-md">
            <h2 className="text-xl font-semibold mb-2">{selectedArticle.title}</h2>
            <div dangerouslySetInnerHTML={{ __html: selectedArticle.content }} />
            <button
              onClick={() => setSelectedArticle(null)}
              className="mt-4 px-4 py-2 rounded-md bg-gray-500 text-white hover:bg-gray-600"
            >
              목록으로 돌아가기
            </button>
          </div>
        ) : !isCreatingNewPost && (
          <div className="mb-4 border p-4 rounded-md">
            <h2 className="text-xl font-semibold mb-2">최신 글 ({selectedCategory})</h2>
            {
              filteredArticles.length > 0 ? (
                <ul>
                  {filteredArticles.map((article) => {
                    const plainTextContent = stripHtmlTags(article.content);
                    const firstImage = article.images && article.images.length > 0 ? article.images[0] : null;
                    
                    return (
                      <li
                        key={article.id}
                        className="mb-3 p-4 border rounded-md hover:bg-gray-100 cursor-pointer min-h-[120px] flex items-center justify-between"
                        onClick={() => setSelectedArticle(article)}
                      >
                        <div className="flex-1 pr-4">
                          <h3 className="text-lg font-semibold mb-2">{article.title}</h3>
                          <p className="text-gray-600 text-sm leading-relaxed">
                            {plainTextContent.substring(0, 150)}...
                          </p>
                        </div>
                        {firstImage && (
                          <div className="flex-shrink-0 w-24 h-24">
                            <img
                              src={firstImage}
                              alt="미리보기"
                              className="w-full h-full object-cover rounded-md border"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>선택된 카테고리에 해당하는 글이 없습니다.</p>
              )
            }
          </div>
        )}



        {isCreatingNewPost && !isAdmin && (
          <div className="mt-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="관리자 비밀번호를 입력하세요"
              className="border p-2 rounded-md mr-2"
            />
            <button
              onClick={() => {
                if (password === adminPassword) {
                  setIsAdmin(true);
                  setIsCreatingNewPost(true);
                } else {
                  alert('비밀번호가 틀렸습니다.');
                  setPassword(''); // 비밀번호 초기화
                }
              }}
              className="px-4 py-2 rounded-md bg-green-500 text-white hover:bg-green-600"
            >
              확인
            </button>
            <button
              onClick={() => {
                setIsCreatingNewPost(false);
                setPassword('');
              }}
              className="ml-2 px-4 py-2 rounded-md bg-gray-500 text-white hover:bg-gray-600"
            >
              취소
            </button>
          </div>
        )}

        {isAdmin && isCreatingNewPost && (
          <div className="w-full">
            <SimpleEditor
              onSave={handleNewPostSave as (title: string, content: string, imageUrls?: string[]) => void}
              onCancel={() => {
                setIsCreatingNewPost(false);
                setNewPostTitle(''); // 제목 초기화
              }}
              initialContent=""
              initialTitle={newPostTitle}
              onImageUpload={handleImageUpload} // 이미지 업로드 핸들러 전달
            />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TechnicalDataPage;