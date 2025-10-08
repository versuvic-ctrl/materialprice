'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Download, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import {
  MakeItFromDatabase,
  MakeItFromMaterial,
  MaterialComparisonItem,
  PropertyComparison,
  MajorCategory,
  MiddleCategory,
  CategoryHierarchy,
  MAJOR_CATEGORIES
} from '@/types/makeItFrom';

import {
  createMaterialComparison,
  formatMaterialName,
  extractCategories,
  generateMaterialId,
  mapToMakeItFromCategory,
  getMiddleCategoriesByMajor
} from '@/utils/makeItFromUtils';

interface MakeItFromComparisonProps {
  database: MakeItFromDatabase;
}

export default function MakeItFromComparison({ database }: MakeItFromComparisonProps) {
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialComparisonItem[]>([]);
  const [selectedMajorCategory, setSelectedMajorCategory] = useState<MajorCategory | ''>('');
  const [selectedMiddleCategory, setSelectedMiddleCategory] = useState<MiddleCategory | ''>('');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [comparisonData, setComparisonData] = useState<PropertyComparison[]>([]);

  // 데이터 로딩 상태 확인
  const isDataLoaded = useMemo(() => {
    return database && Array.isArray(database) && database.length > 0;
  }, [database]);

  // 카테고리 목록 추출 (최적화)
  const categories = useMemo(() => {
    if (!database?.materials) {
      return [];
    }
    
    // 표준 카테고리만 반환하여 성능 개선
    return [
      'Metals > Aluminum Alloys',
      'Metals > Cobalt Alloys', 
      'Metals > Copper Alloys',
      'Metals > Iron Alloys',
      'Metals > Magnesium Alloys',
      'Metals > Nickel Alloys',
      'Metals > Titanium Alloys',
      'Metals > Zinc Alloys',
      'Metals > Otherwise Unclassified Metals',
      'Polymerics > Thermoplastics',
      'Polymerics > Thermoset Elastomers (Rubber)',
      'Polymerics > Thermoset Plastics',
      'Polymerics > Wood-Based Materials',
      'Ceramics > Glass and Glass-Ceramics',
      'Ceramics > Natural Stone',
      'Ceramics > Non-Glass Optical Ceramics',
      'Ceramics > Non-Oxide Engineering Ceramics',
      'Ceramics > Oxide-Based Engineering Ceramics'
    ].sort();
  }, [database?.materials]);

  // 필터링된 재료 목록
  const filteredMaterials = useMemo(() => {
    if (!database || !Array.isArray(database)) return [];
    
    return database.filter(material => {
      const categoryHierarchy = mapToMakeItFromCategory(material.category);
      
      // 대분류 필터링
      if (selectedMajorCategory && categoryHierarchy.major !== selectedMajorCategory) {
        return false;
      }
      
      // 중분류 필터링
      if (selectedMiddleCategory && categoryHierarchy.middle !== selectedMiddleCategory) {
        return false;
      }
      
      return true;
    });
  }, [database, selectedMajorCategory, selectedMiddleCategory]);

  // 중분류 옵션 계산
  const middleCategoryOptions = useMemo(() => {
    if (!selectedMajorCategory) return [];
    return getMiddleCategoriesByMajor(selectedMajorCategory);
  }, [selectedMajorCategory]);

  // 비교 데이터 업데이트
  useEffect(() => {
    const comparison = createMaterialComparison(selectedMaterials);
    setComparisonData(comparison);
  }, [selectedMaterials]);

  // 카테고리 변경 핸들러
  const handleMajorCategoryChange = (value: string) => {
    setSelectedMajorCategory(value as MajorCategory);
    setSelectedMiddleCategory(''); // 대분류 변경 시 중분류 초기화
    setSelectedMaterial(''); // 재료 선택 초기화
  };

  const handleMiddleCategoryChange = (value: string) => {
    setSelectedMiddleCategory(value as MiddleCategory);
    setSelectedMaterial(''); // 중분류 변경 시 재료 선택 초기화
  };



  // 재료 제거
  const handleRemoveMaterial = (id: string) => {
    setSelectedMaterials(prev => prev.filter(item => item.id !== id));
  };

  // 재료 추가 함수
  const addMaterial = () => {
    if (!selectedMaterial) return;
    
    const material = filteredMaterials.find(m => formatMaterialName(m) === selectedMaterial);
    if (!material) return;
    
    // 중복 체크
    const isDuplicate = selectedMaterials.some(item => 
      formatMaterialName(item.material) === formatMaterialName(material)
    );
    
    if (isDuplicate) return;
    
    const newItem: MaterialComparisonItem = {
      id: generateMaterialId(material, selectedMaterials.length),
      material: material,
      displayName: formatMaterialName(material)
    };
    
    setSelectedMaterials(prev => [...prev, newItem]);
    setSelectedMaterial('');
  };

  // 모든 재료 제거
  const handleClearAll = () => {
    setSelectedMaterials([]);
    setSelectedMajorCategory('');
    setSelectedMiddleCategory('');
    setSelectedMaterial('');
  };

  // 데이터 내보내기
  const handleExportData = () => {
    if (selectedMaterials.length === 0) return;

    const csvData = [
      ['Property', 'Unit', ...selectedMaterials.map(item => item.displayName)],
      ...comparisonData.map(prop => [
        prop.propertyName,
        prop.unit,
        ...prop.values.map(v => v.value)
      ])
    ];

    const csvContent = csvData.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `material_comparison_makeitfrom_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 데이터가 로딩되지 않았을 때
  if (!isDataLoaded) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <h3 className="text-lg font-medium mb-2">재료 데이터를 로딩 중입니다...</h3>
            <p className="text-muted-foreground">
              MakeItFrom 데이터베이스를 불러오고 있습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 재료 선택 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            재료 선택
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 대분류 선택 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">대분류</label>
              <Select value={selectedMajorCategory} onValueChange={handleMajorCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="대분류 선택" />
                </SelectTrigger>
                <SelectContent>
                  {MAJOR_CATEGORIES.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 중분류 선택 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">중분류</label>
              <Select 
                value={selectedMiddleCategory} 
                onValueChange={handleMiddleCategoryChange}
                disabled={!selectedMajorCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="중분류 선택" />
                </SelectTrigger>
                <SelectContent>
                  {middleCategoryOptions.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
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
                <SelectContent className="max-h-60">
                  {filteredMaterials.map((material, index) => {
                    const materialName = formatMaterialName(material);
                    return (
                      <SelectItem key={index} value={materialName}>
                        {materialName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* 추가 버튼 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">&nbsp;</label>
              <Button 
                onClick={addMaterial}
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
                {selectedMaterials.map(item => (
                  <Badge
                    key={item.id}
                    variant="secondary"
                    className="flex items-center gap-2 px-3 py-1"
                  >
                    {item.displayName}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleRemoveMaterial(item.id)}
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

      {/* 비교 테이블 */}
      {selectedMaterials.length > 0 && comparisonData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>물성 비교</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-64">속성</TableHead>
                    <TableHead className="w-24">단위</TableHead>
                    {selectedMaterials.map((item) => (
                      <TableHead key={item.id} className="min-w-32">
                        {item.displayName}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonData.map((prop, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{prop.propertyName}</TableCell>
                      <TableCell className="text-muted-foreground">{prop.unit}</TableCell>
                      {prop.values.map((value, valueIndex) => (
                        <TableCell key={valueIndex}>
                          {value.value}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : selectedMaterials.length > 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              비교 데이터를 로딩 중입니다...
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Plus className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">재료를 선택하여 비교를 시작하세요</h3>
              <p className="text-muted-foreground mb-4">
                카테고리와 재료를 선택한 후 "재료 추가" 버튼을 클릭하세요.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}