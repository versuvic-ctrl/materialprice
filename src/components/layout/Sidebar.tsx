'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  CalculatorIcon,
  ChartBarIcon,
  UserIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    {
      name: '대시보드',
      href: '/',
      icon: HomeIcon,
      description: '자재 가격 현황'
    },
    {
      name: '자재 가격 상세',
      href: '/materials',
      icon: ChartBarIcon,
      description: '자재 가격 조회'
    },
    {
      name: '물성 및 부식성 상세',
      href: '/comparison',
      icon: ClipboardDocumentListIcon,
      description: '자재 속성 비교'
    },
    {
      name: '엔지니어링 계산기',
      href: '/calculator',
      icon: CalculatorIcon,
      description: '엔지니어링 계산'
    }
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full bg-white shadow-xl z-50 transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
        ${isCollapsed ? 'w-16 lg:w-16' : 'w-64 lg:w-64'}
      `}>
        {/* Logo Section */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <ChartBarIcon className="w-5 h-5 text-white" />
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="text-lg font-bold text-gray-800">Materials</h1>
                <p className="text-xs text-gray-500">Dashboard</p>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Collapse/Expand button - Desktop only */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:block p-1 rounded-md hover:bg-gray-100 transition-colors"
              title={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
            >
              {isCollapsed ? (
                <ChevronRightIcon className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronLeftIcon className="w-4 h-4 text-gray-600" />
              )}
            </button>
            
            {/* Mobile close button */}
            <button
              title="사이드바 닫기"
              onClick={() => setIsOpen(false)}
              className="lg:hidden p-1 rounded-md hover:bg-gray-100"
            >
              <XMarkIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className={`flex-1 py-6 space-y-2 ${isCollapsed ? 'px-2' : 'px-4'}`}>
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)} // Close mobile menu on navigation
                className={`
                  flex items-center rounded-lg text-sm font-medium transition-all duration-200 group relative
                  ${isCollapsed ? 'px-2 py-3 justify-center' : 'px-3 py-3'}
                  ${isActive 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
                title={isCollapsed ? item.name : ''}
              >
                <Icon className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'} ${isActive ? 'text-white' : 'text-gray-500'}`} />
                {!isCollapsed && (
                  <div className="flex-1">
                    <div className={`font-medium ${isActive ? 'text-white' : 'text-gray-900'}`}>
                      {item.name}
                    </div>
                    <div className={`text-xs ${isActive ? 'text-blue-100' : 'text-gray-500'}`}>
                      {item.description}
                    </div>
                  </div>
                )}
                
                {/* Tooltip for collapsed mode */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    {item.name}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Section */}
        {!isCollapsed ? (
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  Engineer
                </p>
                <p className="text-xs text-gray-500 truncate">
                  materials@company.com
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t border-gray-200 p-2 flex justify-center">
            <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center group relative">
              <UserIcon className="w-4 h-4 text-white" />
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                Engineer
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {!isCollapsed && (
          <div className="border-t border-gray-200 p-4">
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Materials Dashboard v1.0
              </p>
              <p className="text-xs text-gray-400 mt-1">
                © 2024 Engineering Team
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;