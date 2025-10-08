'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Droplets, Zap } from 'lucide-react';

interface CorrosionInfoProps {
  selectedMaterials: Array<{
    id: string;
    name: string;
    properties: { [key: string]: { value: string; unit?: string } };
    composition: { [key: string]: string };
    active: boolean;
  }>;
}

// 부식 저항성 등급 매핑
const corrosionResistanceMapping: { [key: string]: { grade: string; color: string; description: string } } = {
  // 스테인리스강
  '304': { grade: 'A', color: 'bg-green-100 text-green-800', description: '우수한 일반 부식 저항성' },
  '316': { grade: 'A+', color: 'bg-green-100 text-green-800', description: '염화물 환경에서 우수한 저항성' },
  '321': { grade: 'A', color: 'bg-green-100 text-green-800', description: '고온 부식 저항성 우수' },
  '347': { grade: 'A', color: 'bg-green-100 text-green-800', description: '입계 부식 저항성 우수' },
  '410': { grade: 'B', color: 'bg-yellow-100 text-yellow-800', description: '보통 수준의 부식 저항성' },
  '430': { grade: 'B', color: 'bg-yellow-100 text-yellow-800', description: '보통 수준의 부식 저항성' },
  
  // 알루미늄 합금
  '6061': { grade: 'B+', color: 'bg-blue-100 text-blue-800', description: '양호한 부식 저항성' },
  '7075': { grade: 'B', color: 'bg-yellow-100 text-yellow-800', description: '응력 부식 균열 주의' },
  
  // 탄소강
  'A36': { grade: 'C', color: 'bg-red-100 text-red-800', description: '부식 방지 처리 필요' },
  'A572': { grade: 'C', color: 'bg-red-100 text-red-800', description: '부식 방지 처리 필요' },
  
  // 기본값
  'default': { grade: 'B', color: 'bg-gray-100 text-gray-800', description: '일반적인 부식 저항성' }
};

// 환경별 부식 위험도
const environmentalRisks = [
  {
    icon: <Droplets className="w-5 h-5" />,
    name: '해수 환경',
    description: '염화물 이온에 의한 공식 및 틈새 부식',
    materials: {
      high: ['A36', 'A572', '410', '430'],
      medium: ['304', '6061'],
      low: ['316', '321', '347']
    }
  },
  {
    icon: <AlertTriangle className="w-5 h-5" />,
    name: '산성 환경',
    description: '산에 의한 전면 부식 및 국부 부식',
    materials: {
      high: ['A36', 'A572', '7075'],
      medium: ['410', '430', '6061'],
      low: ['304', '316', '321', '347']
    }
  },
  {
    icon: <Zap className="w-5 h-5" />,
    name: '고온 환경',
    description: '고온 산화 및 크리프 손상',
    materials: {
      high: ['A36', 'A572', '6061', '7075'],
      medium: ['304', '316', '410', '430'],
      low: ['321', '347']
    }
  }
];

// 재료명에서 등급 추출
const getMaterialGrade = (materialName: string): { grade: string; color: string; description: string } => {
  // 재료명에서 숫자 부분 추출 (예: "Stainless Steel 316" -> "316")
  const gradeMatch = materialName.match(/(\d{3,4})/);
  if (gradeMatch) {
    const grade = gradeMatch[1];
    return corrosionResistanceMapping[grade] || corrosionResistanceMapping['default'];
  }
  
  // 알루미늄 합금 체크
  if (materialName.toLowerCase().includes('aluminum') || materialName.toLowerCase().includes('알루미늄')) {
    if (materialName.includes('6061')) return corrosionResistanceMapping['6061'];
    if (materialName.includes('7075')) return corrosionResistanceMapping['7075'];
  }
  
  // 탄소강 체크
  if (materialName.toLowerCase().includes('carbon') || materialName.toLowerCase().includes('탄소강')) {
    return corrosionResistanceMapping['A36'];
  }
  
  return corrosionResistanceMapping['default'];
};

// 환경별 위험도 계산
const getRiskLevel = (materialName: string, environment: typeof environmentalRisks[0]) => {
  const gradeMatch = materialName.match(/(\d{3,4})/);
  const grade = gradeMatch ? gradeMatch[1] : 'default';
  
  if (environment.materials.high.includes(grade)) return { level: 'high', text: '높음', color: 'bg-red-100 text-red-800' };
  if (environment.materials.medium.includes(grade)) return { level: 'medium', text: '보통', color: 'bg-yellow-100 text-yellow-800' };
  if (environment.materials.low.includes(grade)) return { level: 'low', text: '낮음', color: 'bg-green-100 text-green-800' };
  
  return { level: 'medium', text: '보통', color: 'bg-gray-100 text-gray-800' };
};

export default function CorrosionInfo({ selectedMaterials }: CorrosionInfoProps) {
  const activeMaterials = selectedMaterials.filter(m => m.active);

  if (activeMaterials.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <div className="text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">재료를 선택해주세요</p>
            <p className="text-sm">
              재료를 선택하면 부식 저항성 정보를 확인할 수 있습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 부식 저항성 등급 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            부식 저항성 등급
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-600 bg-gray-50">
                    재료명
                  </th>
                  <th className="text-center py-2 px-3 text-sm font-medium text-gray-600 bg-gray-50">
                    등급
                  </th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-600 bg-gray-50">
                    특성
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeMaterials.map((material, index) => {
                  const corrosionInfo = getMaterialGrade(material.name);
                  return (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3">
                        <div className="text-sm font-medium text-gray-900">
                          {material.name}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge className={corrosionInfo.color}>
                          {corrosionInfo.grade}
                        </Badge>
                      </td>
                      <td className="py-2 px-3">
                        <div className="text-sm text-gray-600">
                          {corrosionInfo.description}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 환경별 부식 위험도 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            환경별 부식 위험도
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {environmentalRisks.map((environment, envIndex) => (
              <div key={envIndex} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  {environment.icon}
                  <h4 className="font-medium text-gray-900">{environment.name}</h4>
                </div>
                <p className="text-sm text-gray-600 mb-4">{environment.description}</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-600 bg-gray-50">
                          재료명
                        </th>
                        <th className="text-center py-2 px-3 text-sm font-medium text-gray-600 bg-gray-50">
                          위험도
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMaterials.map((material, matIndex) => {
                        const risk = getRiskLevel(material.name, environment);
                        return (
                          <tr key={matIndex} className="border-b border-gray-100">
                            <td className="py-2 px-3">
                              <div className="text-sm text-gray-900">
                                {material.name}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <Badge className={risk.color}>
                                {risk.text}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 부식 방지 권장사항 */}
      <Card>
        <CardHeader>
          <CardTitle>부식 방지 권장사항</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">일반적인 부식 방지 방법</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 적절한 표면 처리 (도장, 도금, 양극산화 등)</li>
                <li>• 정기적인 점검 및 유지보수</li>
                <li>• 부식성 환경 노출 최소화</li>
                <li>• 전기화학적 보호 (음극 보호법)</li>
              </ul>
            </div>
            
            <div className="p-4 bg-yellow-50 rounded-lg">
              <h4 className="font-medium text-yellow-900 mb-2">재료별 특별 주의사항</h4>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• 스테인리스강: 염화물 환경에서 공식 주의</li>
                <li>• 알루미늄 합금: 갈바닉 부식 방지를 위한 절연 처리</li>
                <li>• 탄소강: 습도 관리 및 방청 처리 필수</li>
                <li>• 이종 금속 접촉 시 갈바닉 부식 방지</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}