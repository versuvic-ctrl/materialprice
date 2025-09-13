import React, { useState, useMemo } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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

interface ASMEMaterialSelectorProps {
  selectedMaterial?: ASMEMaterial;
  onMaterialSelect: (material: ASMEMaterial) => void;
  placeholder?: string;
  className?: string;
}

export const ASMEMaterialSelector: React.FC<ASMEMaterialSelectorProps> = ({
  selectedMaterial,
  onMaterialSelect,
  placeholder = "ASME 자재 선택",
  className = ""
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isOpen, setIsOpen] = useState(false);

  // 필터링된 자재 목록
  const filteredMaterials = useMemo(() => {
    let materials = asmeMaterials;
    
    // 카테고리 필터링
    if (selectedCategory !== 'all') {
      materials = getMaterialsByCategory(selectedCategory);
    }
    
    // 검색어 필터링
    if (searchQuery.trim()) {
      materials = searchMaterials(searchQuery).filter(material => 
        selectedCategory === 'all' || material.category === selectedCategory
      );
    }
    
    return materials;
  }, [searchQuery, selectedCategory]);

  const handleMaterialSelect = (material: ASMEMaterial) => {
    onMaterialSelect(material);
    setIsOpen(false);
    setSearchQuery('');
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