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
export const DASHBOARD_CHARTS_CONFIG = [
  {
    title: '철금속(Ferrous metals)',
    materials: [
      { id: '스테인리스열연강판 STS304 -  (HR) 3~6', displayName: 'STS304' },
      { id: '스테인리스냉연강판 STS316(2B) -  2.0, 31.92', displayName: 'STS316' },
      { id: '후판 -  6.0 ≤T ≤7.0, 2,438 ×6,096㎜', displayName: 'SS275' },
      { id: '고장력철근(하이바)(SD 400) -  D10㎜, 0.560', displayName: '고장력철근' },
      { id: 'H형강 -  (소형)H200×B100×t₁5.5×t₂8㎜ 단중21.3㎏/m', displayName: 'H형강' },
      { id: '고철(철) - 중량철 A ', displayName: '고철(중량철A)' }
    ]
  },
  {
    title: '비철금속(Non-ferrous metals)',
    materials: [
      { id: '니켈 -  원소기호 Ni, 순도 99.9%', displayName: '니켈(Ni)' },
      { id: '알루미늄 -  원소기호 Al, 순도 99.8%', displayName: '알루미늄(Al)' },
      { id: '규소 -  원소기호 Si, 중국산, 순도 Si(98.5% 이상) Fe(0.5% 이하)', displayName: '규소(Si)' },
      { id: '주석 -  원소기호 Sn, 순도 99.85%', displayName: '주석(Sn)' },
      { id: '전기동 -  원소기호 Cu, 순도 99.99%', displayName: '전기동(Cu)' },
      { id: '연괴 -  원소기호 Pb, 순도 99.97% 이상', displayName: '연괴(Pb)' },
    ]
  },
  {
    title: '플라스틱',
    materials: [
      { id: 'PP -  (Copolymer)', displayName: 'PP' },
      { id: 'HDPE -  파이프용', displayName: 'HDPE' },
      { id: '경질염화비닐관(수도용VP)-직관 - VP PN 16 호칭경100㎜, 외경114㎜, 두께6.7(최소)㎜, 중량13,636g/본', displayName: 'PVC관(4")' },
      { id: 'FRP DUCT(원형) -  호칭경: 4″, 내경: 100㎜ - 파이프', displayName: 'FRP관(4")' },
      { id: '일반용PE하수관-유공관 -  규격100㎜, 외경114㎜, 두께5.5㎜, 중량1.79㎏/m', displayName: 'PE관(4")' },
    ]
  },
  {
    title: '테프론',
    materials: [
      //{ id: 'PTFE(테프론)판(백색) -  5T 1,000×1,000', displayName: 'PTFE' },
      { id: 'UHP PVDF PIPE SDR21 - (1PC=5M) 110㎜', displayName: 'PVDF관(4",5m)' },
      { id: 'ECTFE PIPE SDR21(1본=5m) -  110㎜', displayName: 'ECTFE(4",5m)' },
    ]
  },
  {
    title: '전기자재',
    materials: [
      { id: 'FW-CV케이블 -  0.6/1KV 3C 16㎟', displayName: '저압케이블' },
      { id: 'FW-CV케이블 -  6/10KV 3C 35㎟', displayName: '고압케이블' },
      //{ id: 'FW-CVV-AMS - 1pair', displayName: '제어케이블' },
      { id: 'F-GV -  70㎟', displayName: '접지케이블' },
      //{ id: '후강전선관 아연도금 - 외경21.0㎜, 두께2.3㎜, 중량1.06㎏/m', displayName: '후강전선관' },
    ]
  },
  {
    title: '토건자재',
    materials: [
      { id: '보통포틀랜드시멘트 -  40㎏ 入', displayName: '시멘트(40㎏)' },
      { id: '레미콘 - 25 24, 120', displayName: '레미콘' },
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
        <CardContent className="p-2 flex flex-wrap items-center justify-end gap-3">
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