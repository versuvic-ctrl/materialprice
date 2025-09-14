// src/components/dashboard/DashboardChartGrid.tsx
'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useMaterialStore from '@/store/materialStore';
import DashboardMiniChart from '@/components/dashboard/DashboardMiniChart';

// 대시보드 차트 설정: 여기에 표시하고 싶은 차트와 자재를 정의합니다.
// 중요: materials 배열 안의 이름은 DB의 'specification' 컬럼에 있는 실제 값과 일치해야 합니다.
const DASHBOARD_CHARTS_CONFIG = [
      {
    title: '철금속',
    materials: [
      { id: 'SUS38203403924_ts3234', displayName: 'SUS304' },
      { id: '고장력철근(하이바)(SD 400) -  D10㎜, 0.560', displayName: '고장력철근' },
      { id: 'H형강 -  (소형)H588×B300×t₁12×t₂20㎜ 단중151㎏/m', displayName: 'H형강' },
    ]
  },
  {
    title: '비철금속',
    materials: [
      { id: 'AL6061-T6_PLATE_10MM', displayName: 'AL6061' },
      { id: 'COPPER_PIPE_TYPE_L', displayName: '구리' },
      { id: 'NICKEL_PIPE_TYPE_L', displayName: '니켈' },
      { id: 'SILVER_PIPE_TYPE_L', displayName: '은' },
    ]
  },
   {
    title: '플라스틱',
    materials: [
      { id: 'PTFE', displayName: 'PTFE' },
      { id: 'ABS', displayName: 'ABS' },
      { id: 'PC', displayName: 'PC' },
      { id: 'HDPE', displayName: 'HDPE' },
    ]
  },
   {
    title: '테프론',
    materials: [
      { id: 'PTFE', displayName: 'PTFE' },
      { id: 'ABS', displayName: 'ABS' },
      { id: 'PC', displayName: 'PC' },
      { id: 'HDPE', displayName: 'HDPE' },
    ]
  },
  {
    title: '전기자재',
    materials: [
      { id: '전선', displayName: '전선' },
      { id: '전자', displayName: '전자' },
      { id: '전자제품', displayName: '전자제품' },
    ]
  },
  {
    title: '토건자재',
    materials: [
      { id: 'AL6061-T6_PLATE_10MM', displayName: 'AL6061' },
      { id: 'COPPER_PIPE_TYPE_L', displayName: '구리' },
      { id: 'NICKEL_PIPE_TYPE_L', displayName: '니켈' },
      { id: 'SILVER_PIPE_TYPE_L', displayName: '은' },
    ]
  }
];

;

export default function DashboardChartGrid() {
  // Zustand 스토어에서 공통 컨트롤을 위한 상태와 액션을 가져옵니다.
  const { interval, setInterval, startDate, endDate, setDateRange } = useMaterialStore();

  return (
    <div className="space-y-4">
      {/* 공통 컨트롤 영역 */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="interval-dashboard" className="text-sm font-medium">조회 간격</Label>
            <Select value={interval} onValueChange={(value: any) => setInterval(value)}>
              <SelectTrigger id="interval-dashboard" className="w-24 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">주간</SelectItem>
                <SelectItem value="monthly">월간</SelectItem>
                <SelectItem value="yearly">연간</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="start-date-dashboard" className="text-sm font-medium">시작일</Label>
            <Input id="start-date-dashboard" type="date" value={startDate} onChange={(e) => setDateRange(e.target.value, endDate)} className="w-36 h-8" />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="end-date-dashboard" className="text-sm font-medium">종료일</Label>
            <Input id="end-date-dashboard" type="date" value={endDate} onChange={(e) => setDateRange(startDate, e.target.value)} className="w-36 h-8" />
          </div>
        </CardContent>
      </Card>

      {/* 차트 그리드 영역 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-2 gap-3">
        {DASHBOARD_CHARTS_CONFIG.map((chartConfig) => (
          <DashboardMiniChart
            key={chartConfig.title}
            title={chartConfig.title}
            materials={chartConfig.materials}
          />
        ))}
      </div>
    </div>
  );
}