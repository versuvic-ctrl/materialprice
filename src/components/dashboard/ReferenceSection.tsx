'use client';

import Link from 'next/link';
import React, { useState, useEffect } from 'react';
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
  category: string; // Changed from literal union to string
  rating: number;
  isBookmarked: boolean;
}

interface ReferenceSectionProps {
  title?: string;
}

const ReferenceSection: React.FC<ReferenceSectionProps> = ({ title = '참고 자료' }) => {
  const [referenceItems, setReferenceItems] = useState<ReferenceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReferenceItems = async () => {
      try {
        const response = await fetch('/api/technical-articles');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // API 응답 데이터를 ReferenceItem 인터페이스에 맞게 매핑
        const mappedItems: ReferenceItem[] = data.map((item: any) => ({
          id: item.id.toString(),
          title: item.title,
          description: item.description || '설명 없음',
          url: item.url || '#', // API 응답에 url이 없으면 기본값으로 '#' 설정
          category: item.category || 'guide', // API 응답에 category가 없으면 기본값으로 'guide' 설정
          rating: item.rating || 5, // API 응답에 rating이 없으면 기본값으로 5 설정
          isBookmarked: item.isBookmarked || false, // API 응답에 isBookmarked가 없으면 기본값으로 false 설정
        }));
        setReferenceItems(mappedItems);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReferenceItems();
  }, []);

  const getCategoryInfo = (category: string) => {
    const categoryMap = {
      '기계/배관': { label: '기계/배관', color: 'bg-blue-100 text-blue-800', icon: DocumentTextIcon },
      '전기/계기': { label: '전기/계기', color: 'bg-yellow-100 text-yellow-800', icon: LinkIcon },
      '규격/법규': { label: '규격/법규', color: 'bg-red-100 text-red-800', icon: BookOpenIcon },
      '기타': { label: '기타', color: 'bg-gray-100 text-gray-800', icon: BookOpenIcon },
      '표준': { label: '표준', color: 'bg-blue-100 text-blue-800', icon: DocumentTextIcon },
      '규정': { label: '규정', color: 'bg-red-100 text-red-800', icon: BookOpenIcon },
      '가이드': { label: '가이드', color: 'bg-green-100 text-green-800', icon: BookOpenIcon },
      '계산기': { label: '계산기', color: 'bg-purple-100 text-purple-800', icon: LinkIcon },
      'DB': { label: 'DB', color: 'bg-orange-100 text-orange-800', icon: LinkIcon }
    };

    // Try to find a match by key (e.g., 'standard')
    if (categoryMap.hasOwnProperty(category)) {
      return categoryMap[category as keyof typeof categoryMap];
    }

    // Try to find a match by label (e.g., '표준')
    for (const key in categoryMap) {
      if (categoryMap[key as keyof typeof categoryMap].label === category) {
        return categoryMap[key as keyof typeof categoryMap];
      }
    }

    return categoryMap['기타']; // Default to '기타' if no match is found
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-2">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <BookOpenIcon className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        
        <a href="/technical-data" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1 self-start sm:self-auto">
          <span>전체보기</span>
          <ArrowTopRightOnSquareIcon className="w-4 h-4" />
        </a>
      </div>

      {/* Reference Grid */}
      {loading && <p className="text-center text-gray-500">참고 자료를 불러오는 중...</p>}
      {error && <p className="text-center text-red-500">오류 발생: {error}</p>}
      {!loading && !error && referenceItems.length === 0 && <p className="text-center text-gray-500">참고 자료가 없습니다.</p>}
      {!loading && !error && referenceItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 flex-grow">
          {referenceItems.map((item) => {
            const categoryInfo = getCategoryInfo(item.category);
            const CategoryIcon = categoryInfo.icon;
            
            return (
              <Link
                key={item.id}
                href="/technical-data"
                className="group p-3 sm:p-4 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-200 cursor-pointer block"
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
                
                {/* <div className="flex items-center justify-between">
                  {renderStars(item.rating)}
                  <span className="text-xs text-gray-500">
                    평점 {item.rating}/5
                  </span>
                </div> */}
              </Link>
            );
          })}
        </div>
      )}

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