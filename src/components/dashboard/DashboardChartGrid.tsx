// src/components/dashboard/DashboardChartGrid.tsx
'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useMaterialStore from '@/store/materialStore';
import DashboardMiniChart from '@/components/dashboard/DashboardMiniChart';
import { DASHBOARD_CHARTS_CONFIG } from '@/config/chartConfig'; // --- [수정] 여기서 가져옵니다.

// 대시보드 차트 설정: src/config/chartConfig.ts 여기에 표시하고 싶은 차트와 자재를 정의합니다.

export default function DashboardChartGrid() {
  // Zustand 스토어에서 공통 컨트롤을 위한 상태와 액션을 가져옵니다.
  const { interval, setInterval, startDate, endDate, setDateRange } = useMaterialStore();

  return (
    <div className="space-y-4">
      {/* 공통 컨트롤 영역 */}
      <Card>
        <CardContent className="p-2 sm:p-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
            <div className="flex sm:flex-row sm:items-center gap-2">
              <Label htmlFor="interval-dashboard" className="text-sm font-medium whitespace-nowrap">조회 간격</Label>
              <Select value={interval} onValueChange={(value: any) => setInterval(value)}>
                <SelectTrigger id="interval-dashboard" className="w-full sm:w-24 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">주간</SelectItem>
                  <SelectItem value="monthly">월간</SelectItem>
                  <SelectItem value="yearly">연간</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex sm:flex-row sm:items-center gap-2">
              <Label htmlFor="start-date-dashboard" className="text-sm font-medium whitespace-nowrap">시작일</Label>
              <Input id="start-date-dashboard" type="date" value={startDate} onChange={(e) => setDateRange(e.target.value, endDate)} className="w-full sm:w-36 h-8 pr-8" />
            </div>
            <div className="flex sm:flex-row sm:items-center gap-2">
              <Label htmlFor="end-date-dashboard" className="text-sm font-medium whitespace-nowrap">종료일</Label>
              <Input id="end-date-dashboard" type="date" value={endDate} onChange={(e) => setDateRange(startDate, e.target.value)} className="w-full sm:w-36 h-8 pr-8" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 차트 그리드 영역 */}
      <div className="grid grid-cols-1 sm:landscape:grid-cols-2 md:landscape:grid-cols-2 lg:grid-cols-2 gap-4">
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