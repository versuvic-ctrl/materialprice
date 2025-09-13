'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { getMaterialHistory } from '@/lib/api'; // 경로 수정
import { getMaterialProperties } from '@/lib/utils'; // 경로 수정
import PriceChart from '@/components/dashboard/PriceChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Material, MaterialProperty, MaterialPrice, MaterialHistory } from '@/types/materials'; // 타입 import 추가
import { Period } from '@/types/period';
import { ChevronsRight } from 'lucide-react';

interface ChartRow {
  date: string;
  [key: string]: string | number;
}

export default function MaterialDetailPage() {
  const params = useParams();
  const material = decodeURIComponent((params?.material as string) || '');

  // `materials/page.tsx`와 일관성 있도록 상태 관리 로직 수정
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('monthly');
  const [startDate, setStartDate] = useState<string>('2025-01-01');
  const [endDate, setEndDate] = useState<string>('2025-12-31');

  const [current, setCurrent] = useState<MaterialPrice | null>(null);
  const [history, setHistory] = useState<MaterialHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const chartData: ChartRow[] = useMemo(() => {
    if (!material) return [];
    return history.map(h => ({ date: h.date, [material]: h.price }));
  }, [history, material]);

  useEffect(() => {
    const loadData = async () => {
      if (!material) return;
      setLoading(true);
      setError(null);
      try {
        // getCurrentPrices는 현재 구현에서 직접 호출하지 않으므로 제거
        // const prices = await getCurrentPrices(); 
        // const cur = Object.values(prices).find(p => p.material === material) || null;
        // setCurrent(cur);

        const histRes = await getMaterialHistory(material, selectedPeriod, startDate, endDate);
        setHistory(histRes.data || []);
        if (histRes.data && histRes.data.length > 0) {
            const lastData = histRes.data[histRes.data.length - 1];
            setCurrent({ material: lastData.material, price: lastData.price, unit: '원/kg', change: '' });
        }

      } catch (e) {
        console.error(e);
        setError('데이터를 불러오지 못했습니다. 샘플 데이터를 표시합니다.');
        const today = new Date();
        const samples: MaterialHistory[] = Array.from({ length: 14 }).map((_, i) => {
          const d = new Date(today);
          d.setDate(today.getDate() - (13 - i));
          return { date: d.toISOString().split('T')[0], material, price: 1000 + i * 10 };
        });
        setHistory(samples);
        setCurrent({ material, price: 1000 + 13 * 10, unit: '원/kg', change: '+1.3%' });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [material, selectedPeriod, startDate, endDate]);

  const handleRangeChange = (period: Period, start?: string, end?: string) => {
    setSelectedPeriod(period);
    if (period === 'custom' && start && end) {
      setStartDate(start);
      setEndDate(end);
    } else {
        // 기간 변경 시 날짜 초기화 (2025년 기준)
        if (period === 'weekly') {
          setStartDate('2025-08-01');
          setEndDate('2025-09-30');
        } else if (period === 'monthly') {
          setStartDate('2025-06-01');
          setEndDate('2025-09-30');
        } else if (period === 'yearly') {
          setStartDate('2024-10-01');
          setEndDate('2025-09-30');
        }
    }
  };

  // 통계 계산
  const stats = useMemo(() => {
    if (!history.length) return { last: 0, prev: 0, d1: 0, d7: 0, avg30: 0, vol: 0 };
    const prices = history.map(h => h.price);
    const last = prices[prices.length - 1];
    const prev = prices.length > 1 ? prices[prices.length - 2] : last;
    const d1 = last - prev;
    const d7 = prices.length > 7 ? last - prices[prices.length - 8] : 0;
    const avg30 = prices.reduce((s, v) => s + v, 0) / prices.length;
    const mean = avg30;
    const variance = prices.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / prices.length;
    const vol = Math.sqrt(variance);
    return { last, prev, d1, d7, avg30, vol };
  }, [history]);

  const formatKRW = (v: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(v);

  if (!material) {
      notFound();
  }

  return (
    <Layout title={`자재 상세 - ${material || ''}`}>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{material}</h1>
              <p className="text-sm text-gray-500 mt-1">기간: 일간/주간/월간, 그래프에서 토글 가능</p>
            </div>
            {current && (
              <div className="text-right">
                <p className="text-sm text-gray-500">현재가</p>
                <p className="text-2xl font-bold text-blue-600">{formatKRW(current.price)}</p>
                <p className="text-xs text-gray-400">단위: {current.unit || '원/kg'}</p>
              </div>
            )}
          </div>
        </div>

        {/* KPI 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">전일 대비</p>
            <p className={`text-xl font-semibold ${stats.d1 >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stats.d1 >= 0 ? '+' : ''}{stats.d1.toFixed(0)} 원</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">1주일 변화</p>
            <p className={`text-xl font-semibold ${stats.d7 >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stats.d7 >= 0 ? '+' : ''}{stats.d7.toFixed(0)} 원</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">평균(표본)</p>
            <p className="text-xl font-semibold text-gray-900">{formatKRW(stats.avg30)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">변동성(표준편차)</p>
            <p className="text-xl font-semibold text-gray-900">{stats.vol.toFixed(0)} 원</p>
          </div>
        </div>

        {/* 차트 */}
        <PriceChart
          data={chartData}
          title={`${material} 가격 추이`}
          materials={[material]}
          height={400}
        />

        {/* 히스토리 표 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">최근 가격 이력</h3>
            <p className="text-sm text-gray-500">총 {history.length}개</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">날짜</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가격</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.slice(-30).reverse().map((h, idx) => (
                  <tr key={`${h.date}-${idx}`}>
                    <td className="px-4 py-2 text-sm text-gray-700">{h.date}</td>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{formatKRW(h.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}