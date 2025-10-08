/**
 * ASMEMaterialSelector.tsx - ASME 자재 선택 드롭다운 컴포넌트
 * 
 * 🎯 기능:
 * - ASME 표준 자재 검색 및 선택
 * - 카테고리별 필터링 (탄소강, 스테인리스강, 알루미늄 등)
 * - 실시간 검색 (자재 코드, 이름)
 * - 드롭다운 UI로 사용자 친화적 인터페이스
 * 
 * 🔗 연관 파일:
 * - data/asmeMaterials.ts: ASME 자재 데이터 및 유틸리티 함수
 * - components/ui/*: 재사용 가능한 UI 컴포넌트들
 * - 계산기 페이지에서 자재 선택 시 사용
 * 
 * ⭐ 중요도: ⭐⭐ 중요 - 엔지니어링 계산에 필요한 자재 선택 기능
 * 
 * 📊 데이터 소스: 정적 ASME 자재 데이터베이스
 */
import React, { useState, useMemo } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  asmeMaterials,
  materialCategories,
  getMaterialsByCategory,
  searchMaterials,
  type ASMEMaterial
} from '@/data/asmeMaterials';

// 컴포넌트 Props 타입 정의
interface ASMEMaterialSelectorProps {
  selectedMaterial?: ASMEMaterial;                    // 현재 선택된 자재
  onMaterialSelect: (material: ASMEMaterial) => void; // 자재 선택 시 콜백 함수
  placeholder?: string;                               // 플레이스홀더 텍스트
  className?: string;                                 // 추가 CSS 클래스
}

export const ASMEMaterialSelector: React.FC<ASMEMaterialSelectorProps> = ({
  selectedMaterial,
  onMaterialSelect,
  placeholder = "ASME 자재 선택",
  className = ""
}) => {
  // 검색어 상태
  const [searchQuery, setSearchQuery] = useState('');
  // 선택된 카테고리 ('all' 또는 특정 카테고리)
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  // 드롭다운 열림/닫힘 상태
  const [isOpen, setIsOpen] = useState(false);

  // 필터링된 자재 목록 (카테고리 + 검색어 조합)
  const filteredMaterials = useMemo(() => {
    let materials = asmeMaterials;
    
    // 1단계: 카테고리 필터링
    if (selectedCategory !== 'all') {
      materials = getMaterialsByCategory(selectedCategory);
    }
    
    // 2단계: 검색어 필터링 (자재 코드, 이름 기준)
    if (searchQuery.trim()) {
      materials = searchMaterials(searchQuery).filter(material => 
        selectedCategory === 'all' || material.category === selectedCategory
      );
    }
    
    return materials;
  }, [searchQuery, selectedCategory]);

  // 자재 선택 처리 함수
  const handleMaterialSelect = (material: ASMEMaterial) => {
    onMaterialSelect(material);  // 부모 컴포넌트에 선택된 자재 전달
    setIsOpen(false);           // 드롭다운 닫기
    setSearchQuery('');         // 검색어 초기화
  };

  return (
    <div className={`relative ${className}`}>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between text-left font-normal"
          >
            <div className="flex flex-col items-start">
              {selectedMaterial ? (
                <>
                  <span className="font-medium">{selectedMaterial.code}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {selectedMaterial.name}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent className="w-96 max-h-96 overflow-y-auto">
          {/* 검색 입력 */}
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="자재 코드 또는 이름 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          
          <DropdownMenuSeparator />
          
          {/* 카테고리 필터 */}
          <div className="p-2">
            <div className="flex flex-wrap gap-1">
              <Badge
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => setSelectedCategory('all')}
              >
                전체
              </Badge>
              {materialCategories.map((category) => (
                <Badge
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Badge>
              ))}
            </div>
          </div>
          
          <DropdownMenuSeparator />
          
          {/* 자재 목록 */}
          <div className="max-h-64 overflow-y-auto">
            {filteredMaterials.length > 0 ? (
              filteredMaterials.map((material) => (
                <DropdownMenuItem
                  key={material.code}
                  onClick={() => handleMaterialSelect(material)}
                  className="flex flex-col items-start p-3 cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">{material.code}</span>
                    <Badge variant="secondary" className="text-xs">
                      {material.category}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground mt-1">
                    {material.name}
                  </span>
                  {material.description && (
                    <span className="text-xs text-muted-foreground mt-1">
                      {material.description}
                    </span>
                  )}
                </DropdownMenuItem>
              ))
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                검색 결과가 없습니다.
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default ASMEMaterialSelector;