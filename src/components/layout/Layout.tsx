/**
 * Layout.tsx - 애플리케이션 전체 레이아웃 컴포넌트
 * 
 * 🎯 기능:
 * - 반응형 사이드바 네비게이션 (데스크톱/모바일)
 * - 상단 헤더 (검색, 알림, 프로필)
 * - 페이지 콘텐츠 래퍼
 * - 사이드바 접힘/펼침 상태 관리 (localStorage 저장)
 * 
 * 🔗 연관 파일:
 * - app/layout.tsx: 루트 레이아웃에서 이 컴포넌트 사용
 * - 모든 페이지 컴포넌트: 이 레이아웃으로 감싸짐
 * 
 * ⭐ 중요도: ⭐⭐⭐ 필수 - 전체 UI 구조의 핵심
 * 
 * 📱 반응형 지원:
 * - 모바일: 오버레이 사이드바
 * - 데스크톱: 고정 사이드바 (접힘/펼침 가능)
 */
'use client';

import { useState, useEffect, memo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  DocumentTextIcon,
  CalculatorIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  BellIcon,
  UserCircleIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';


// 레이아웃 컴포넌트 Props 타입 정의
interface LayoutProps {
  children: React.ReactNode; // 페이지 콘텐츠
}

// 네비게이션 메뉴 구성
// 각 메뉴는 이름, 경로, 아이콘을 포함
const navigation = [
  { name: '대시보드', href: '/', icon: HomeIcon },
  { name: '자재 가격 상세', href: '/materials', icon: ChartBarIcon },
  { name: '물성 및 부식성 상세', href: '/comparison', icon: DocumentTextIcon },
  { name: '엔지니어링 계산기', href: '/calculator', icon: CalculatorIcon },
  { name: '기술자료', href: '/technical-data', icon: DocumentTextIcon },
  { name: '설정', href: '/settings', icon: ShieldCheckIcon },
  
];

function Layout({ children }: LayoutProps) {
  // 모바일 사이드바 열림/닫힘 상태
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 데스크톱 사이드바 접힘/펼침 상태
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // 현재 페이지 경로 (활성 메뉴 표시용)
  const pathname = usePathname();

  // 현재 경로에 맞는 페이지 제목 찾기
  let pageTitle = '';
  if (pathname.startsWith('/calculator')) {
    pageTitle = '엔지니어링 계산기';
  } else {
    const currentPage = navigation.find((item) => item.href === pathname);
    pageTitle = currentPage ? currentPage.name : '';
  }

  // 클라이언트에서만 localStorage 값을 불러와서 상태 설정
  // 사이드바 접힘 상태를 브라우저 새로고침 후에도 유지
  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved) {
      setSidebarCollapsed(JSON.parse(saved));
    }
  }, []);

  // 사이드바 접힘 상태를 토글하고 localStorage에 저장
  const toggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
  };

  return (
    <div className="flex bg-gray-50 h-screen">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">MT</span>
              </div>
              <span className="ml-2 text-lg font-semibold text-gray-900">Materials</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close sidebar"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      prefetch={true}
                      onClick={() => setSidebarOpen(false)}
                      className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <item.icon
                        className={`mr-3 h-5 w-5 ${
                          isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-500'
                        }`}
                      />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 ${
        sidebarCollapsed ? 'lg:w-20' : 'lg:w-60'
      }`}>
        <div className="flex flex-col h-full bg-white border-r border-gray-200 relative">
          {/* Logo */}
          <div className={`flex items-center h-16 px-4 border-b border-gray-200 ${
            sidebarCollapsed ? 'justify-center' : ''
          }`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">MT</span>
                </div>
              </div>
              {!sidebarCollapsed && (
                <div className="ml-3">
                  <h1 className="text-base font-semibold text-gray-900">Materials Dashboard</h1>
                </div>
              )}
            </div>
          </div>
          
          {/* Toggle button */}
          <button
            onClick={toggleSidebar}
            className="absolute -right-3 top-16 z-10 flex h-8 w-5 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 transition-colors"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRightIcon className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronLeftIcon className="h-4 w-4 text-gray-600" />
            )}
          </button>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      prefetch={true}
                      className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      } ${
                        sidebarCollapsed ? 'justify-center' : ''
                      }`}
                      title={sidebarCollapsed ? item.name : ''}
                    >
                      <item.icon
                        className={`h-6 w-6 ${
                          sidebarCollapsed ? '' : 'mr-3'
                        } ${
                          isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-500'
                        }`}
                      />
                      {!sidebarCollapsed && item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User section */}
          <div className="border-t border-gray-200 p-4">
            <div className={`flex items-center ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}>
              <UserCircleIcon className="h-6 w-6 text-gray-400" />
              {!sidebarCollapsed && (
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700">관리자</p>
                  <p className="text-xs text-gray-500">최성호 M</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 flex flex-col ${
        sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-60'
      }`}>
        {/* Top header */}
        <header className="sticky top-0 z-50 bg-white border-b border-gray-200 h-16">
          <div className="flex items-center justify-between h-full px-3 sm:px-4 lg:px-6">
            <div className="flex items-center">
              <button
                aria-label="Open sidebar"
                title="Open sidebar"
                onClick={() => setSidebarOpen(true)}
                className="text-gray-500 hover:text-gray-600 lg:hidden"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900 ml-2 lg:ml-0">{pageTitle}</h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="hidden md:block">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="검색..."
                    className="block w-48 pl-8 pr-2 py-1 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              {/* Notifications */}
              <button
                className="text-gray-400 hover:text-gray-500"
                aria-label="Notifications"
                title="Notifications"
              >
                <BellIcon className="h-5 w-5" />
              </button>

              {/* Profile */}
              <button
                className="text-gray-400 hover:text-gray-500"
                aria-label="Profile"
                title="Profile"
              >
                <UserCircleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-3 py-3 sm:px-5 lg:px-7 overflow-y-auto overflow-x-hidden max-w-full">
          {children}
        </main>
      </div>
    </div>
  );
}

export default memo(Layout);