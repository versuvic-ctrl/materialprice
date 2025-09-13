'use client';

import Layout from '@/components/layout/Layout';
import { useState, useEffect } from 'react';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  DocumentArrowDownIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

interface ASMEMaterial {
  id: string;
  code: string;
  name: string;
  category: string;
  subcategory: string;
  specification: string;
  grade: string;
  size: string;
  pressure: string;
  temperature: string;
  material: string;
  weight: number;
  price: number;
  supplier: string;
  description: string;
  standard: string;
  lastUpdated: string;
}

const asmeMaterials: ASMEMaterial[] = [
  {
    id: '1',
    code: 'ASME-PV-001',
    name: '압력용기 헤드 (Torispherical)',
    category: '압력용기',
    subcategory: '헤드',
    specification: 'ASME VIII Div.1',
    grade: 'SA-516 Gr.70',
    size: 'DN 1000',
    pressure: '10 bar',
    temperature: '200°C',
    material: 'Carbon Steel',
    weight: 125.5,
    price: 850000,
    supplier: 'KPI',
    description: '토리스페리컬 헤드, 압력용기용',
    standard: 'ASME BPVC VIII',
    lastUpdated: '2024-01-15'
  },
  {
    id: '2',
    code: 'ASME-FL-001',
    name: '플랜지 (Weld Neck)',
    category: '플랜지',
    subcategory: 'Weld Neck',
    specification: 'ASME B16.5',
    grade: 'A105',
    size: 'DN 150 PN16',
    pressure: '16 bar',
    temperature: '400°C',
    material: 'Carbon Steel',
    weight: 8.2,
    price: 45000,
    supplier: 'KPI',
    description: '용접목 플랜지, Class 150',
    standard: 'ASME B16.5',
    lastUpdated: '2024-01-15'
  },
  {
    id: '3',
    code: 'ASME-EL-001',
    name: '엘보 90도 (Long Radius)',
    category: '피팅',
    subcategory: '엘보',
    specification: 'ASME B16.9',
    grade: 'A234 WPB',
    size: 'DN 100 Sch.40',
    pressure: '40 bar',
    temperature: '400°C',
    material: 'Carbon Steel',
    weight: 2.8,
    price: 25000,
    supplier: 'KPI',
    description: '90도 장반경 엘보',
    standard: 'ASME B16.9',
    lastUpdated: '2024-01-15'
  },
  {
    id: '4',
    code: 'ASME-TE-001',
    name: '티 (Equal Tee)',
    category: '피팅',
    subcategory: '티',
    specification: 'ASME B16.9',
    grade: 'A234 WPB',
    size: 'DN 80 Sch.40',
    pressure: '40 bar',
    temperature: '400°C',
    material: 'Carbon Steel',
    weight: 3.5,
    price: 35000,
    supplier: 'KPI',
    description: '동경 티',
    standard: 'ASME B16.9',
    lastUpdated: '2024-01-15'
  },
  {
    id: '5',
    code: 'ASME-RD-001',
    name: '리듀서 (Concentric)',
    category: '피팅',
    subcategory: '리듀서',
    specification: 'ASME B16.9',
    grade: 'A234 WPB',
    size: 'DN 150x100',
    pressure: '40 bar',
    temperature: '400°C',
    material: 'Carbon Steel',
    weight: 4.2,
    price: 28000,
    supplier: 'KPI',
    description: '동심 리듀서',
    standard: 'ASME B16.9',
    lastUpdated: '2024-01-15'
  },
  {
    id: '6',
    code: 'ASME-VL-001',
    name: '게이트 밸브',
    category: '밸브',
    subcategory: '게이트밸브',
    specification: 'ASME B16.34',
    grade: 'A216 WCB',
    size: 'DN 100 PN16',
    pressure: '16 bar',
    temperature: '400°C',
    material: 'Cast Steel',
    weight: 15.8,
    price: 180000,
    supplier: 'KPI',
    description: '게이트 밸브, Class 150',
    standard: 'ASME B16.34',
    lastUpdated: '2024-01-15'
  },
  {
    id: '7',
    code: 'ASME-PP-001',
    name: '배관 (Seamless)',
    category: '배관',
    subcategory: '무계목관',
    specification: 'ASME B36.10M',
    grade: 'A106 Gr.B',
    size: 'DN 100 Sch.40',
    pressure: '40 bar',
    temperature: '400°C',
    material: 'Carbon Steel',
    weight: 17.5,
    price: 12000,
    supplier: 'KPI',
    description: '무계목 탄소강관 (6m)',
    standard: 'ASME B36.10M',
    lastUpdated: '2024-01-15'
  },
  {
    id: '8',
    code: 'ASME-TK-001',
    name: '저장탱크 (Vertical)',
    category: '탱크',
    subcategory: '수직탱크',
    specification: 'API 650',
    grade: 'A516 Gr.70',
    size: 'D3000 x H6000',
    pressure: '1 bar',
    temperature: '60°C',
    material: 'Carbon Steel',
    weight: 2500.0,
    price: 15000000,
    supplier: 'KPI',
    description: '수직 저장탱크, 42㎥',
    standard: 'API 650',
    lastUpdated: '2024-01-15'
  }
];

const categories = ['전체', '압력용기', '플랜지', '피팅', '밸브', '배관', '탱크'];
const subcategories = {
  '압력용기': ['헤드', '동체', '노즐'],
  '플랜지': ['Weld Neck', 'Slip On', 'Blind', 'Socket Weld'],
  '피팅': ['엘보', '티', '리듀서', '캡'],
  '밸브': ['게이트밸브', '글로브밸브', '체크밸브', '볼밸브'],
  '배관': ['무계목관', '용접관', '스테인리스관'],
  '탱크': ['수직탱크', '수평탱크', '구형탱크']
};

export default function ASMEDataPage() {
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedSubcategory, setSelectedSubcategory] = useState('전체');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredMaterials, setFilteredMaterials] = useState(asmeMaterials);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);

  useEffect(() => {
    let filtered = asmeMaterials;

    // 카테고리 필터
    if (selectedCategory !== '전체') {
      filtered = filtered.filter(material => material.category === selectedCategory);
    }

    // 서브카테고리 필터
    if (selectedSubcategory !== '전체') {
      filtered = filtered.filter(material => material.subcategory === selectedSubcategory);
    }

    // 검색어 필터
    if (searchTerm) {
      filtered = filtered.filter(material => 
        material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        material.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        material.specification.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredMaterials(filtered);
  }, [selectedCategory, selectedSubcategory, searchTerm]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setSelectedSubcategory('전체');
  };

  const toggleMaterialSelection = (materialId: string) => {
    setSelectedMaterials(prev => 
      prev.includes(materialId) 
        ? prev.filter(id => id !== materialId)
        : [...prev, materialId]
    );
  };

  const exportSelectedToBOM = () => {
    const selected = asmeMaterials.filter(material => 
      selectedMaterials.includes(material.id)
    );
    
    if (selected.length === 0) {
      alert('선택된 자재가 없습니다.');
      return;
    }

    // P&ID 편집기로 데이터 전송 (localStorage 사용)
    localStorage.setItem('selectedASMEMaterials', JSON.stringify(selected));
    alert(`${selected.length}개 자재가 선택되었습니다. P&ID 편집기에서 확인하세요.`);
  };

  const exportToExcel = () => {
    const selected = selectedMaterials.length > 0 
      ? asmeMaterials.filter(material => selectedMaterials.includes(material.id))
      : filteredMaterials;

    const csvContent = [
      ['코드', '자재명', '카테고리', '규격', '등급', '크기', '압력', '온도', '재질', '중량(kg)', '가격(원)', '공급업체'],
      ...selected.map(material => [
        material.code,
        material.name,
        material.category,
        material.specification,
        material.grade,
        material.size,
        material.pressure,
        material.temperature,
        material.material,
        material.weight,
        material.price,
        material.supplier
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ASME_Materials_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Layout title="ASME 자재 데이터">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">ASME 자재 데이터베이스</h1>
        <p className="text-gray-600">
          ASME 표준 기반 자재 정보를 검색하고 P&ID 편집기에서 활용하세요
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 space-y-4">
        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            카테고리
          </label>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryChange(category)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Subcategory Filter */}
        {selectedCategory !== '전체' && subcategories[selectedCategory as keyof typeof subcategories] && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              세부 카테고리
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedSubcategory('전체')}
                className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                  selectedSubcategory === '전체'
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                전체
              </button>
              {subcategories[selectedCategory as keyof typeof subcategories].map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubcategory(sub)}
                  className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                    selectedSubcategory === sub
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search and Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="자재명, 코드, 규격으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportSelectedToBOM}
              disabled={selectedMaterials.length === 0}
              className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <ClipboardDocumentListIcon className="h-5 w-5" />
              BOM 추가 ({selectedMaterials.length})
            </button>
            <button
              onClick={exportToExcel}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <DocumentArrowDownIcon className="h-5 w-5" />
              Excel 내보내기
            </button>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-4 text-sm text-gray-600">
        총 {filteredMaterials.length}개 자재 | 선택됨: {selectedMaterials.length}개
      </div>

      {/* Materials Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  선택
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  코드
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  자재명
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  규격
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  크기
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  재질
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  중량(kg)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  가격(원)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMaterials.map((material) => (
                <tr 
                  key={material.id} 
                  className={`hover:bg-gray-50 transition-colors ${
                    selectedMaterials.includes(material.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="px-4 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedMaterials.includes(material.id)}
                      onChange={() => toggleMaterialSelection(material.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {material.code}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{material.name}</div>
                      <div className="text-sm text-gray-500">{material.category} &gt; {material.subcategory}</div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm text-gray-900">{material.specification}</div>
                      <div className="text-sm text-gray-500">{material.grade}</div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {material.size}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {material.material}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {material.weight.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₩{material.price.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {filteredMaterials.length === 0 && (
        <div className="text-center py-12">
          <Cog6ToothIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">검색 결과가 없습니다</h3>
          <p className="mt-1 text-sm text-gray-500">
            다른 검색어나 필터를 시도해보세요.
          </p>
        </div>
      )}
    </Layout>
  );
}