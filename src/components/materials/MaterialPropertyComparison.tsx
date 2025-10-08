/**
 * MaterialPropertyComparison.tsx - 재료 물성 비교 컴포넌트
 * 
 * 기능:
 * - 재료 선택 및 추가/제거
 * - 선택된 재료들의 물성 정보를 테이블 형태로 비교
 * - 가로 컬럼에 재료, 세로에 물성 정보 배치
 * - 영국단위계와 SI단위계 간 변환 기능
 * - GitHub KittyCAD/material-properties 데이터 활용
 * 
 * 연관 파일:
 * - src/types/materialProperties.ts (타입 정의)
 * - src/data/materialData.ts (샘플 데이터)
 * - src/utils/unitConversion.ts (단위 변환)
 */
'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { X, Plus, Download, RotateCcw, Settings } from 'lucide-react';
import { 
  MaterialSelection, 
  MaterialProperties,
  PROPERTY_UNITS,
  MATERIAL_CATEGORIES,
  PropertyUnit
} from '@/types/materialProperties';
import { ALL_MATERIALS, getMaterialsByCategory } from '@/data/materialData';
import { 
  convertPropertyToSI, 
  formatPropertyValue, 
  UNIT_INFO,
  UnitSystem 
} from '@/utils/unitConversion';

interface MaterialPropertyComparisonProps {
  className?: string;
}

const MaterialPropertyComparison: React.FC<MaterialPropertyComparisonProps> = ({ 
  className = '' 
}) => {
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialSelection[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [useSI, setUseSI] = useState<boolean>(false); // 단위 시스템 상태

  // 카테고리별 재료 필터링
  const filteredMaterials = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'all') return ALL_MATERIALS;
    return ALL_MATERIALS.filter(material => material.category === selectedCategory);
  }, [selectedCategory]);

  // 재료 추가
  const handleAddMaterial = () => {
    if (!selectedMaterial) return;
    
    const material = ALL_MATERIALS.find(m => m.id === selectedMaterial);
    if (material && !selectedMaterials.find(m => m.id === material.id)) {
      setSelectedMaterials(prev => [...prev, material]);
    }
    
    // 선택 초기화
    setSelectedMaterial('');
  };

  // 재료 제거
  const handleRemoveMaterial = (materialId: string) => {
    setSelectedMaterials(prev => prev.filter(m => m.id !== materialId));
  };

  // 모든 재료 제거
  const handleClearAll = () => {
    setSelectedMaterials([]);
    setSelectedCategory('all');
    setSelectedMaterial('');
  };

  // 값 포맷팅 (단위 변환 포함)
  const formatValue = (propertyKey: string, value: number | undefined): string => {
    if (value === undefined) return '-';
    
    // SI 단위로 변환이 필요한 경우
    const convertedValue = useSI ? convertPropertyToSI(propertyKey, value) : value;
    if (convertedValue === undefined) return '-';
    
    // 큰 숫자는 과학적 표기법 또는 천 단위 구분자 사용
    if (convertedValue >= 1000000) {
      return `${(convertedValue / 1000000).toFixed(1)}M`;
    } else if (convertedValue >= 1000) {
      return convertedValue.toLocaleString();
    } else {
      return convertedValue.toFixed(2);
    }
  };

  // 단위 표시
  const getUnit = (propertyKey: string): string => {
    const unitInfo = UNIT_INFO[propertyKey];
    if (!unitInfo) return '';
    return useSI ? unitInfo.si : unitInfo.imperial;
  };

  // 비교 데이터 내보내기 (CSV 형태)
  const handleExportData = () => {
    if (selectedMaterials.length === 0) return;

    const unitSuffix = useSI ? '_SI' : '_Imperial';
    const headers = ['물성', '단위', ...selectedMaterials.map(m => m.displayName)];
    const rows = PROPERTY_UNITS.map(prop => [
      prop.name,
      getUnit(prop.key),
      ...selectedMaterials.map(material => 
        formatValue(prop.key, material.properties[prop.key as keyof MaterialProperties] as number)
      )
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `material_comparison${unitSuffix}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 재료 선택 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            재료 선택
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 카테고리 선택 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">재료 카테고리</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {MATERIAL_CATEGORIES.map(category => (
                    <SelectItem key={category.key} value={category.key}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 재료 선택 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">재료</label>
              <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                <SelectTrigger>
                  <SelectValue placeholder="재료 선택" />
                </SelectTrigger>
                <SelectContent>
                  {filteredMaterials.map(material => (
                    <SelectItem key={material.id} value={material.id}>
                      {material.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 추가 버튼 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">&nbsp;</label>
              <Button 
                onClick={handleAddMaterial}
                disabled={!selectedMaterial}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                재료 추가
              </Button>
            </div>
          </div>

          {/* 선택된 재료 목록 */}
          {selectedMaterials.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  선택된 재료 ({selectedMaterials.length}개)
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportData}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    내보내기
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearAll}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    전체 삭제
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedMaterials.map(material => (
                  <Badge
                    key={material.id}
                    variant="secondary"
                    className="flex items-center gap-2 px-3 py-1"
                  >
                    {material.displayName}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleRemoveMaterial(material.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 물성 비교 테이블 */}
      {selectedMaterials.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>물성 비교</CardTitle>
              {/* 단위 시스템 토글 */}
              <div className="flex items-center gap-3">
                <Settings className="w-4 h-4 text-gray-500" />
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${!useSI ? 'font-medium' : 'text-gray-500'}`}>
                    영국단위
                  </span>
                  <Switch
                    checked={useSI}
                    onCheckedChange={setUseSI}
                    aria-label="단위 시스템 변경"
                  />
                  <span className={`text-sm ${useSI ? 'font-medium' : 'text-gray-500'}`}>
                    SI단위
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium bg-gray-50">물성</th>
                    <th className="text-left p-3 font-medium bg-gray-50">단위</th>
                    {selectedMaterials.map(material => (
                      <th key={material.id} className="text-center p-3 font-medium bg-blue-50 min-w-[120px]">
                        {material.displayName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PROPERTY_UNITS.map((property, index) => (
                    <tr key={property.key} className={index % 2 === 0 ? 'bg-gray-25' : 'bg-white'}>
                      <td className="p-3 font-medium border-b">
                        <div>
                          <div className="font-medium">{property.name}</div>
                          <div className="text-xs text-gray-500">{property.description}</div>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-gray-600 border-b">
                        {getUnit(property.key)}
                      </td>
                      {selectedMaterials.map(material => {
                        const value = material.properties[property.key as keyof MaterialProperties] as number;
                        return (
                          <td key={material.id} className="p-3 text-center border-b">
                            <span className="font-mono">
                              {formatValue(property.key, value)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 빈 상태 메시지 */}
      {selectedMaterials.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-gray-500">
              <Plus className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">재료를 선택해주세요</p>
              <p className="text-sm">
                위에서 재료를 선택하면 물성 정보를 비교할 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MaterialPropertyComparison;