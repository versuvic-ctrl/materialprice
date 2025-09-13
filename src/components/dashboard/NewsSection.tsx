'use client';

import React from 'react';
import {
  NewspaperIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  date: string;
  source: string;
  url?: string;
  category: 'market' | 'industry' | 'policy' | 'technology';
}

interface NewsSectionProps {
  title?: string;
}

const NewsSection: React.FC<NewsSectionProps> = ({ title = '최근 뉴스' }) => {
  // 샘플 뉴스 데이터
  const newsItems: NewsItem[] = [
    {
      id: '1',
      title: '철강 가격 상승세 지속, 건설업계 비상',
      summary: '국제 철강 가격이 3개월 연속 상승하며 건설업계에 부담이 가중되고 있습니다.',
      date: '2024-01-15',
      source: '산업일보',
      category: 'market',
      url: '#'
    },
    {
      id: '2',
      title: '알루미늄 공급망 안정화 정책 발표',
      summary: '정부가 알루미늄 공급망 안정화를 위한 새로운 정책을 발표했습니다.',
      date: '2024-01-14',
      source: '금속신문',
      category: 'policy',
      url: '#'
    },
    {
      id: '3',
      title: '스테인리스강 신기술 개발로 원가 절감 기대',
      summary: '국내 기업이 개발한 새로운 스테인리스강 제조 기술이 주목받고 있습니다.',
      date: '2024-01-13',
      source: '기술뉴스',
      category: 'technology',
      url: '#'
    },
    {
      id: '4',
      title: '중국 철강 수출 규제 강화, 국내 시장 영향 분석',
      summary: '중국의 철강 수출 규제 강화가 국내 철강 시장에 미칠 영향을 분석합니다.',
      date: '2024-01-12',
      source: '경제신문',
      category: 'industry',
      url: '#'
    },
    {
      id: '5',
      title: '친환경 자재 수요 급증, 관련 업체 주가 상승',
      summary: '친환경 건설 자재에 대한 수요가 급증하면서 관련 업체들의 주가가 상승하고 있습니다.',
      date: '2024-01-11',
      source: '환경일보',
      category: 'market',
      url: '#'
    }
  ];

  const getCategoryColor = (category: NewsItem['category']) => {
    const colors = {
      market: 'bg-blue-100 text-blue-800',
      industry: 'bg-green-100 text-green-800',
      policy: 'bg-purple-100 text-purple-800',
      technology: 'bg-orange-100 text-orange-800'
    };
    return colors[category];
  };

  const getCategoryLabel = (category: NewsItem['category']) => {
    const labels = {
      market: '시장',
      industry: '산업',
      policy: '정책',
      technology: '기술'
    };
    return labels[category];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1일 전';
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <NewspaperIcon className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          전체보기
        </button>
      </div>

      {/* News List */}
      <div className="space-y-4">
        {newsItems.map((item) => (
          <div
            key={item.id}
            className="group p-4 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {/* Category Badge */}
                <div className="flex items-center space-x-2 mb-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(item.category)}`}>
                    {getCategoryLabel(item.category)}
                  </span>
                  <div className="flex items-center text-xs text-gray-500">
                    <ClockIcon className="w-3 h-3 mr-1" />
                    {formatDate(item.date)}
                  </div>
                </div>
                
                {/* Title */}
                <h4 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors mb-1 line-clamp-2">
                  {item.title}
                </h4>
                
                {/* Summary */}
                <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                  {item.summary}
                </p>
                
                {/* Source */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    출처: {item.source}
                  </span>
                  {item.url && (
                    <ArrowTopRightOnSquareIcon className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>마지막 업데이트: {new Date().toLocaleString('ko-KR')}</span>
          <span>총 {newsItems.length}개 뉴스</span>
        </div>
      </div>
    </div>
  );
};

export default NewsSection;