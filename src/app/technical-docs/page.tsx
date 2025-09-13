'use client';

import Layout from '@/components/layout/Layout';
import { DocumentTextIcon, BookOpenIcon, AcademicCapIcon, LinkIcon } from '@heroicons/react/24/outline';

interface TechnicalDoc {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string;
  type: 'standard' | 'regulation' | 'guide' | 'reference';
  tags: string[];
  lastUpdated: string;
}

const technicalDocs: TechnicalDoc[] = [
  {
    id: '1',
    title: 'ASME Boiler and Pressure Vessel Code',
    description: '압력용기 및 보일러 설계, 제작, 검사에 관한 국제 표준',
    category: '압력용기',
    url: 'https://www.asme.org/codes-standards/find-codes-standards/bpvc-section-viii-division-1-pressure-vessels',
    type: 'standard',
    tags: ['압력용기', 'ASME', '설계기준'],
    lastUpdated: '2024-01-15'
  },
  {
    id: '2',
    title: 'KS B 6750 압력용기 일반사항',
    description: '한국산업표준 압력용기 제작 및 검사 기준',
    category: '압력용기',
    url: 'https://standard.go.kr',
    type: 'standard',
    tags: ['KS규격', '압력용기', '한국표준'],
    lastUpdated: '2023-12-20'
  },
  {
    id: '3',
    title: '산업안전보건법 시행규칙',
    description: '산업현장 안전보건 관리 및 압력용기 안전검사 규정',
    category: '안전법규',
    url: 'https://www.law.go.kr',
    type: 'regulation',
    tags: ['안전법규', '검사', '관리'],
    lastUpdated: '2024-01-10'
  },
  {
    id: '4',
    title: 'API 650 Welded Steel Tanks',
    description: '용접강재 저장탱크 설계 및 제작 표준',
    category: '저장탱크',
    url: 'https://www.api.org/products-and-services/standards',
    type: 'standard',
    tags: ['API', '저장탱크', '용접'],
    lastUpdated: '2023-11-30'
  },
  {
    id: '5',
    title: 'TEMA Standards',
    description: '관형 열교환기 제조업체 협회 표준',
    category: '열교환기',
    url: 'https://www.tema.org',
    type: 'standard',
    tags: ['TEMA', '열교환기', '설계'],
    lastUpdated: '2023-10-25'
  },
  {
    id: '6',
    title: 'NPSH 계산 가이드',
    description: '펌프 순흡입수두(NPSH) 계산 방법 및 실무 가이드',
    category: '펌프',
    url: '#',
    type: 'guide',
    tags: ['NPSH', '펌프', '계산'],
    lastUpdated: '2024-01-05'
  }
];

const categories = ['전체', '압력용기', '저장탱크', '열교환기', '펌프', '안전법규'];
const types = {
  standard: { label: '표준', color: 'bg-blue-100 text-blue-800' },
  regulation: { label: '법규', color: 'bg-red-100 text-red-800' },
  guide: { label: '가이드', color: 'bg-green-100 text-green-800' },
  reference: { label: '참고자료', color: 'bg-purple-100 text-purple-800' }
};

export default function TechnicalDocsPage() {
  return (
    <Layout title="기술 자료">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">기술 자료</h1>
        <p className="text-gray-600">
          엔지니어링 설계 및 제작에 필요한 표준, 법규, 가이드를 확인하세요
        </p>
      </div>

      {/* Category Filter */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="기술 자료 검색..."
            className="w-full px-4 py-3 pl-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {technicalDocs.map((doc) => (
          <div key={doc.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-50 rounded-lg mr-3">
                  {doc.type === 'standard' && <DocumentTextIcon className="h-6 w-6 text-blue-600" />}
                  {doc.type === 'regulation' && <BookOpenIcon className="h-6 w-6 text-red-600" />}
                  {doc.type === 'guide' && <AcademicCapIcon className="h-6 w-6 text-green-600" />}
                  {doc.type === 'reference' && <LinkIcon className="h-6 w-6 text-purple-600" />}
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${types[doc.type].color}`}>
                  {types[doc.type].label}
                </span>
              </div>
            </div>

            {/* Content */}
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{doc.title}</h3>
            <p className="text-gray-600 text-sm mb-4 line-clamp-3">{doc.description}</p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mb-4">
              {doc.tags.map((tag) => (
                <span key={tag} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                  {tag}
                </span>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                업데이트: {new Date(doc.lastUpdated).toLocaleDateString('ko-KR')}
              </span>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                보기
                <LinkIcon className="h-4 w-4 ml-1" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="mt-8 bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">빠른 링크</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a href="https://www.asme.org" target="_blank" rel="noopener noreferrer" className="flex items-center p-3 bg-white rounded-lg hover:shadow-sm transition-shadow">
            <div className="p-2 bg-blue-50 rounded-lg mr-3">
              <DocumentTextIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">ASME</p>
              <p className="text-sm text-gray-600">미국기계학회</p>
            </div>
          </a>
          <a href="https://www.api.org" target="_blank" rel="noopener noreferrer" className="flex items-center p-3 bg-white rounded-lg hover:shadow-sm transition-shadow">
            <div className="p-2 bg-green-50 rounded-lg mr-3">
              <DocumentTextIcon className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">API</p>
              <p className="text-sm text-gray-600">미국석유협회</p>
            </div>
          </a>
          <a href="https://standard.go.kr" target="_blank" rel="noopener noreferrer" className="flex items-center p-3 bg-white rounded-lg hover:shadow-sm transition-shadow">
            <div className="p-2 bg-purple-50 rounded-lg mr-3">
              <DocumentTextIcon className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">KS 표준</p>
              <p className="text-sm text-gray-600">한국산업표준</p>
            </div>
          </a>
          <a href="https://www.law.go.kr" target="_blank" rel="noopener noreferrer" className="flex items-center p-3 bg-white rounded-lg hover:shadow-sm transition-shadow">
            <div className="p-2 bg-red-50 rounded-lg mr-3">
              <BookOpenIcon className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">법령정보</p>
              <p className="text-sm text-gray-600">국가법령정보센터</p>
            </div>
          </a>
        </div>
      </div>
    </Layout>
  );
}