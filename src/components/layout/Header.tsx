'use client';

import React from 'react';
import {
  Bars3Icon,
  BellIcon,
  MagnifyingGlassIcon,
  UserIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

interface HeaderProps {
  toggleSidebar: () => void;
  title?: string;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar, title = '대시보드' }) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
      <div className="flex items-center justify-between px-4 py-3 lg:px-6">
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          {/* Mobile menu button */}
          <button
            type="button"
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
            onClick={toggleSidebar}
            className="lg:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
          >
            <Bars3Icon className="w-5 h-5 text-gray-600" />
          </button>
          
          {/* Page Title */}
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 hidden sm:block">
              실시간 자재 가격 모니터링 시스템
            </p>
          </div>
        </div>

        {/* Center Section - Search (hidden on mobile) */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="자재명 검색..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-3">
          {/* Search button for mobile */}
          <button
            type="button"
            aria-label="검색"
            title="검색"
            className="md:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
          >
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-600" />
          </button>
          
          {/* Notifications */}
          <div className="relative">
            <button className="p-2 rounded-md hover:bg-gray-100 transition-colors relative">
              <BellIcon className="w-5 h-5 text-gray-600" />
              {/* Notification badge */}
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                3
              </span>
            </button>
          </div>

          {/* User Menu */}
          <div className="relative group">
            <button className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 transition-colors group">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-white" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-gray-900">Engineer</p>
                <p className="text-xs text-gray-500">관리자</p>
              </div>
            </button>
            
            {/* Dropdown Menu */}
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="py-1">
                <a href="#" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  <UserIcon className="w-4 h-4 mr-3 text-gray-500" />
                  프로필
                </a>
                <a href="#" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  <Cog6ToothIcon className="w-4 h-4 mr-3 text-gray-500" />
                  설정
                </a>
                <hr className="my-1 border-gray-200" />
                <a href="#" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  <ArrowRightOnRectangleIcon className="w-4 h-4 mr-3 text-gray-500" />
                  로그아웃
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Search Bar */}
      <div className="md:hidden px-4 pb-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="자재명 검색..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </header>
  );
};

export default Header;