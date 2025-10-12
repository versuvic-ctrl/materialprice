'use client';

import React from 'react';
import {
  BookOpenIcon,
  DocumentTextIcon,
  LinkIcon,
  ArrowTopRightOnSquareIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

interface ReferenceItem {
  id: string;
  title: string;
  description: string;
  url: string;
  category: 'standard' | 'regulation' | 'guide' | 'calculator' | 'database';
  rating: number;
  isBookmarked: boolean;
}

interface ReferenceSectionProps {
  title?: string;
}

const ReferenceSection: React.FC<ReferenceSectionProps> = ({ title = '참고 자료' }) => {
  // 샘플 참고자료 데이터
  const referenceItems: ReferenceItem[] = [
    {
      id: '1',
      title: 'KS D 3503 - 일반구조용 압연강재',
      description: '일반구조용 압연강재의 한국산업표준 규격서입니다.',
      url: 'https://standard.go.kr',
      category: 'standard',
      rating: 5,
      isBookmarked: true
    },
    {
      id: '2',
      title: 'ASTM A36 - 구조용 탄소강 표준',
      description: 'ASTM A36 구조용 탄소강의 국제 표준 규격입니다.',
      url: 'https://astm.org',
      category: 'standard',
      rating: 5,
      isBookmarked: true
    },
    {
      id: '3',
      title: '건설공사 표준품셈',
      description: '국토교통부 건설공사 표준품셈 및 자재 단가 정보입니다.',
      url: 'https://www.molit.go.kr',
      category: 'regulation',
      rating: 4,
      isBookmarked: false
    },
    {
      id: '4',
      title: '강재 중량 계산기',
      description: '다양한 형태의 강재 중량을 계산할 수 있는 온라인 도구입니다.',
      url: '#',
      category: 'calculator',
      rating: 4,
      isBookmarked: true
    },
    {
      id: '5',
      title: '알루미늄 합금 특성 데이터베이스',
      description: '알루미늄 합금의 물리적, 화학적 특성 정보를 제공합니다.',
      url: '#',
      category: 'database',
      rating: 4,
      isBookmarked: false
    },
    {
      id: '6',
      title: '용접 설계 가이드라인',
      description: '구조용 강재 용접 설계 시 참고할 수 있는 가이드라인입니다.',
      url: '#',
      category: 'guide',
      rating: 3,
      isBookmarked: false
    }
  ];

  const getCategoryInfo = (category: ReferenceItem['category']) => {
    const categoryMap = {
      standard: { label: '표준', color: 'bg-blue-100 text-blue-800', icon: DocumentTextIcon },
      regulation: { label: '규정', color: 'bg-red-100 text-red-800', icon: BookOpenIcon },
      guide: { label: '가이드', color: 'bg-green-100 text-green-800', icon: BookOpenIcon },
      calculator: { label: '계산기', color: 'bg-purple-100 text-purple-800', icon: LinkIcon },
      database: { label: 'DB', color: 'bg-orange-100 text-orange-800', icon: LinkIcon }
    };
    return categoryMap[category];
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          star <= rating ? (
            <StarSolidIcon key={star} className="w-3 h-3 text-yellow-400" />
          ) : (
            <StarIcon key={star} className="w-3 h-3 text-gray-300" />
          )
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-2">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <BookOpenIcon className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1 self-start sm:self-auto">
          <span>전체보기</span>
          <ArrowTopRightOnSquareIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Reference Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {referenceItems.map((item) => {
          const categoryInfo = getCategoryInfo(item.category);
          const CategoryIcon = categoryInfo.icon;
          
          return (
            <div
              key={item.id}
              className="group p-3 sm:p-4 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <CategoryIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${categoryInfo.color} truncate`}>
                    {categoryInfo.label}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {item.isBookmarked && (
                    <StarSolidIcon className="w-4 h-4 text-yellow-400" />
                  )}
                  <ArrowTopRightOnSquareIcon className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                </div>
              </div>
              
              <h4 className="text-xs sm:text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors mb-2 line-clamp-2 truncate">
                {item.title}
              </h4>
              
              <p className="text-xs text-gray-600 line-clamp-2 mb-3">
                {item.description}
              </p>
              
              <div className="flex items-center justify-between">
                {renderStars(item.rating)}
                <span className="text-xs text-gray-500">
                  평점 {item.rating}/5
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Links */}
      <div className="mt-4 pt-2 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">빠른 링크</h4>
        <div className="flex flex-wrap gap-2">
          {[
            { name: 'KS 표준', url: '#' },
            { name: 'ASTM 표준', url: '#' },
            { name: '건설공사 표준품셈', url: '#' },
            { name: '한국물가정보', url: '#' },
            { name: '강재 계산기', url: '#' }
          ].map((link) => (
            <a
              key={link.name}
              href={link.url}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              {link.name}
              <ArrowTopRightOnSquareIcon className="w-3 h-3 ml-1" />
            </a>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-2 pt-2 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>총 {referenceItems.length}개 자료</span>
          <span>북마크 {referenceItems.filter(item => item.isBookmarked).length}개</span>
        </div>
      </div>
    </div>
  );
};

export default ReferenceSection;