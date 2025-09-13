'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

interface ChartData {
  date: string;
  [key: string]: number | string;
}

interface DashboardChartsProps {
  title?: string;
  className?: string;
}

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

const DashboardCharts: React.FC<DashboardChartsProps> = ({ 
  title = "자재 가격 동향", 
  className = "" 
}) => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('weekly');
  const [startDate, setStartDate] = useState('2022-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [activeMaterials, setActiveMaterials] = useState<Set<string>>(new Set(['SUS304', 'SUS316', 'AL6061', 'Carbon Steel']));

  // 기간 범위 생성 함수
  const generateDateRange = (start: string, end: string, period: Period): string[] => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const dates: string[] = [];
    const current = new Date(startDate);

    // 시작 날짜를 기간에 맞게 조정
    switch (period) {
      case 'weekly':
        // 주의 시작일(월요일)로 조정
        const dayOfWeek = current.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        current.setDate(current.getDate() - daysToMonday);
        break;
      case 'monthly':
        // 월의 첫째 날로 조정
        current.setDate(1);
        break;
      case 'yearly':
        // 년의 첫째 날로 조정 (startDate 기준)
        current.setMonth(0, 1);
        break;
    }

    while (current <= endDate) {
      dates.push(current.toISOString().split('T')[0]);
      
      switch (period) {
        case 'daily':
          current.setDate(current.getDate() + 1);
          break;
        case 'weekly':
          current.setDate(current.getDate() + 7);
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + 1);
          break;
        case 'yearly':
          current.setFullYear(current.getFullYear() + 1);
          break;
      }
    }
    
    return dates;
  };

  // 샘플 데이터 생성 함수
  const generateSampleData = (dates: string[]): ChartData[] => {
    const basePrice = {
      'SUS304': 8500,
      'SUS316': 12000,
      'AL6061': 3200,
      'Carbon Steel': 1800
    };

    return dates.map((date, index) => {
      const data: ChartData = { date };
      
      Object.entries(basePrice).forEach(([material, price]) => {
        const variation = Math.sin(index * 0.1) * 0.2 + Math.random() * 0.1 - 0.05;
        data[material] = Math.round(price * (1 + variation));
      });
      
      return data;
    });
  };

  // 데이터 로딩
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const dates = generateDateRange(startDate, endDate, selectedPeriod);
        const data = generateSampleData(dates);
        setChartData(data);
        setError(null);
      } catch (err) {
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedPeriod, startDate, endDate]);

  // 자재 토글 함수
  const toggleMaterial = (material: string) => {
    const newActiveMaterials = new Set(activeMaterials);
    if (newActiveMaterials.has(material)) {
      newActiveMaterials.delete(material);
    } else {
      newActiveMaterials.add(material);
    }
    setActiveMaterials(newActiveMaterials);
  };

  // 기간 클릭 핸들러
  const handlePeriodChange = (period: Period) => {
    setSelectedPeriod(period);
  };

  // 날짜 라벨 포맷팅 함수
  const formatDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    switch (selectedPeriod) {
      case 'daily':
        return `${year}/${month}/${day}`;
      case 'weekly':
        const weekOfMonth = Math.ceil(day / 7);
        return `${year}년${month}월${weekOfMonth}주`;
      case 'monthly':
        return `${year}년${month}월`;
      case 'yearly':
        return `${year}년`;
      default:
        return dateStr;
    }
  };

  // X축 라벨 포맷팅 함수
  const formatXAxisLabel = (value: string): string => {
    return formatDateLabel(value);
  };

  // X축 각도 계산 함수
  const getXAxisAngle = (): number => {
    if (selectedPeriod === 'daily' && chartData.length > 10) {
      return -45;
    }
    return 0;
  };

  // 가격 포맷팅 함수
  const formatPrice = (value: number): string => {
    return `₩${value.toLocaleString()}`;
  };

  // 자재 배열
  const materials = [
    { key: 'SUS304', name: 'SUS304', color: '#3b82f6' },
    { key: 'SUS316', name: 'SUS316', color: '#ef4444' },
    { key: 'AL6061', name: 'AL6061', color: '#10b981' },
    { key: 'Carbon Steel', name: 'Carbon Steel', color: '#f59e0b' }
  ];

  if (error) {
    return (
      <Card className={`border-gray-200 ${className}`}>
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-800">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-red-500">
            <div className="text-center">
              <div className="text-4xl mb-2">⚠️</div>
              <p>{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-gray-200 ${className}`}>
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-blue-600">📊</span>
          {title}
        </CardTitle>
        
        {/* 컨트롤 영역 - 자재선택은 왼쪽, 기간/날짜선택은 오른쪽에 배치 */}
        <div className="flex justify-between items-start gap-4 flex-wrap">
          {/* 자재 선택 영역 - 왼쪽 */}
          <div className="flex flex-wrap gap-2 max-w-md">
            {materials.map((material) => (
              <Button
                key={material.key}
                onClick={() => toggleMaterial(material.key)}
                className="flex items-center gap-2 h-9 px-3"
                style={{
                  backgroundColor: activeMaterials.has(material.key) ? material.color : '#e5e7eb',
                  borderColor: material.color,
                  color: activeMaterials.has(material.key) ? 'white' : '#374151'
                }}
              >
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: material.color }}
                />
                {material.name}
              </Button>
            ))}
          </div>
          
          {/* 기간/날짜 선택 - 오른쪽 */}
          <div className="flex flex-wrap items-center gap-4">
            {/* 기간 선택 드롭다운 */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">기간:</label>
              <Select value={selectedPeriod} onValueChange={(value: Period) => handlePeriodChange(value)}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">일간</SelectItem>
                  <SelectItem value="weekly">주간</SelectItem>
                  <SelectItem value="monthly">월간</SelectItem>
                  <SelectItem value="yearly">연간</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* 날짜 선택 */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">시작일:</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-36"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">종료일:</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-36"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="text-center">
              <Skeleton className="h-8 w-32 mb-4 mx-auto" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        ) : (
          <>
            {/* 차트 */}
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatXAxisLabel}
                    angle={getXAxisAngle()}
                    textAnchor={getXAxisAngle() !== 0 ? 'end' : 'middle'}
                    height={getXAxisAngle() !== 0 ? 60 : 30}
                    interval="preserveStartEnd"
                  />
                  <YAxis tickFormatter={formatPrice} />
                  <Tooltip 
                    labelFormatter={(value) => formatDateLabel(value as string)}
                    formatter={(value: number, name: string) => [formatPrice(value), name]}
                  />
                  <Legend />
                  {materials.map((material) => (
                    <Line
                      key={material.key}
                      type="monotone"
                      dataKey={material.key}
                      stroke={material.color}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      connectNulls={false}
                      hide={!activeMaterials.has(material.key)}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* 요약 정보 */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">📋 가격 동향 요약</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                <div>
                  <p><strong>• 최고가:</strong> SUS316 (스테인리스 316)</p>
                  <p><strong>• 최저가:</strong> Carbon Steel (탄소강)</p>
                </div>
                <div>
                  <p><strong>• 변동성:</strong> 중간 수준</p>
                  <p><strong>• 추세:</strong> 안정적 상승</p>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardCharts;
