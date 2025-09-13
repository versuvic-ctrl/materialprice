'use client';

import React, { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, CalendarDays, BarChart3 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import Layout from '@/components/layout/Layout';
import {
  useDashboardSummary,
  useChartData,
  useLevel1Categories,
  useLevel2Categories,
  useLevel3Categories,
  useLevel4Categories
} from '@/hooks/useDashboardApi';

// Period type definition
type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

// Since this component doesn't accept any props, we can use type Record<never, never>
type MaterialsPageProps = Record<never, never>;

const MaterialsPage: React.FC<MaterialsPageProps> = () => {
  const [selectedLevel1Category, setSelectedLevel1Category] = useState<string>('');
  const [selectedLevel2Category, setSelectedLevel2Category] = useState<string>('');
  const [selectedLevel3Category, setSelectedLevel3Category] = useState<string>('');
  const [selectedLevel4Category, setSelectedLevel4Category] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('monthly');
  const [startDate, setStartDate] = useState<string>('2022-01-01');
  const [endDate, setEndDate] = useState<string>('2025-12-31');
  const [selectedMaterialsForChart, setSelectedMaterialsForChart] = useState<string[]>([]);
  const [hiddenMaterials, setHiddenMaterials] = useState<Set<string>>(new Set());

  // 데이터 훅들
  const { data: summaryData, isLoading: summaryLoading } = useDashboardSummary();
  
  // 계층별 카테고리 데이터 가져오기
  const { data: level1Categories, isLoading: level1Loading } = useLevel1Categories();
  const { data: level2Categories } = useLevel2Categories(selectedLevel1Category);
  const { data: level3Categories } = useLevel3Categories(selectedLevel2Category);
  const { data: level4Categories } = useLevel4Categories(selectedLevel3Category);

  // 선택된 자재 목록 생성
  const selectedMaterials = useMemo(() => {
    if (selectedLevel4Category) {
      return [selectedLevel4Category];
    }
    if (selectedLevel3Category && level4Categories?.length === 0) {
      return [];
    }
    return [];
  }, [selectedLevel4Category, selectedLevel3Category, level4Categories]);
  
  // selectedMaterials가 변경될 때 selectedMaterialsForChart도 자동 업데이트
  useEffect(() => {
    if (selectedMaterials.length > 0) {
      setSelectedMaterialsForChart(selectedMaterials);
      console.log('자재 선택 자동 연동:', selectedMaterials);
    }
  }, [selectedMaterials]);
  
  // Generate period range based on selected period
  const generatePeriodRange = useCallback((start: string, end: string, period: Period): string[] => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const periods: string[] = [];
    
    const current = new Date(startDate);
    
    while (current <= endDate) {
      switch (period) {
        case 'daily':
          periods.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
          break;
        case 'weekly':
          const weekStart = new Date(current);
          weekStart.setDate(current.getDate() - current.getDay());
          periods.push(weekStart.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 7);
          break;
        case 'monthly':
          periods.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-01`);
          current.setMonth(current.getMonth() + 1);
          break;
        case 'yearly':
          periods.push(`${current.getFullYear()}-01-01`);
          current.setFullYear(current.getFullYear() + 1);
          break;
      }
    }
    
    return periods;
  }, []);

  // 선택된 자재들에 대한 차트 데이터
  const { data: chartData, isLoading: chartLoading, error: chartError } = useChartData(
    selectedPeriod,
    startDate,
    endDate
  );

  // 차트 데이터 포맷팅
  const formattedChartData = useMemo(() => {
    if (!chartData || selectedMaterialsForChart.length === 0) {
      return [];
    }

    // Generate period range
    const periodRange = generatePeriodRange(startDate, endDate, selectedPeriod);
    
    // Initialize grouped data with all periods
    const groupedData: { [key: string]: any } = {};
    periodRange.forEach(period => {
      groupedData[period] = { date: period };
      selectedMaterialsForChart.forEach(material => {
        groupedData[period][material] = null;
      });
    });

    // Filter and aggregate data
    chartData
      .filter(item => {
        const itemDate = new Date(item.date);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return itemDate >= start && itemDate <= end;
      })
      .forEach(item => {
        const itemDate = new Date(item.date);
        let periodKey: string;

        switch (selectedPeriod) {
          case 'daily':
            periodKey = item.date;
            break;
          case 'weekly':
            const weekStart = new Date(itemDate);
            weekStart.setDate(itemDate.getDate() - itemDate.getDay());
            periodKey = weekStart.toISOString().split('T')[0];
            break;
          case 'monthly':
            periodKey = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-01`;
            break;
          case 'yearly':
            periodKey = `${itemDate.getFullYear()}-01-01`;
            break;
          default:
            periodKey = item.date;
        }

        if (groupedData[periodKey]) {
          selectedMaterialsForChart.forEach(material => {
            if (item[material] !== undefined && item[material] !== null) {
              if (groupedData[periodKey][material] === null) {
                groupedData[periodKey][material] = [];
              }
              groupedData[periodKey][material].push(item[material]);
            }
          });
        }
      });

    // Calculate averages and convert to array
    return Object.values(groupedData).map(period => {
      const result = { ...period };
      selectedMaterialsForChart.forEach(material => {
        if (Array.isArray(result[material]) && result[material].length > 0) {
          result[material] = result[material].reduce((sum: number, val: number) => sum + val, 0) / result[material].length;
        } else {
          result[material] = null;
        }
      });
      return result;
    });
  }, [chartData, selectedMaterialsForChart, startDate, endDate, selectedPeriod, generatePeriodRange]);

  // Toggle material visibility
  const toggleMaterial = useCallback((material: string) => {
    setHiddenMaterials(prev => {
      const newSet = new Set(prev);
      if (newSet.has(material)) {
        newSet.delete(material);
      } else {
        newSet.add(material);
      }
      return newSet;
    });
  }, []);

  // Handle period button click
  const handlePeriodClick = useCallback((period: Period) => {
    setSelectedPeriod(period);
  }, []);

  // Format date labels for tooltip
  const formatDateLabel = useCallback((value: string) => {
    const date = new Date(value);
    switch (selectedPeriod) {
      case 'daily':
        return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
      case 'weekly':
        const weekNumber = Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7);
        return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${weekNumber}주`;
      case 'monthly':
        return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
      case 'yearly':
        return `${date.getFullYear()}년`;
      default:
        return value;
    }
  }, [selectedPeriod]);

  // Format X-axis labels
  const formatXAxisLabel = useCallback((value: string) => {
    const date = new Date(value);
    switch (selectedPeriod) {
      case 'daily':
        return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
      case 'weekly':
        const weekNumber = Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7);
        return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${weekNumber}주`;
      case 'monthly':
        return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
      case 'yearly':
        return `${date.getFullYear()}년`;
      default:
        return value;
    }
  }, [selectedPeriod]);

  // Calculate dynamic angle for X-axis labels based on data length
  const getXAxisAngle = useCallback(() => {
    const dataLength = formattedChartData?.length || 0;
    if (dataLength > 20) return -45;
    if (dataLength > 10) return -30;
    return 0;
  }, [formattedChartData]);

  // Colors for chart lines
  const chartColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

  // 계층별 변경 핸들러
  const handleLevel1CategoryChange = useCallback((category: string) => {
    setSelectedLevel1Category(category);
    setSelectedLevel2Category('');
    setSelectedLevel3Category('');
    setSelectedLevel4Category('');
  }, []);

  const handleLevel2CategoryChange = useCallback((category: string) => {
    setSelectedLevel2Category(category);
    setSelectedLevel3Category('');
    setSelectedLevel4Category('');
  }, []);

  const handleLevel3CategoryChange = useCallback((category: string) => {
    setSelectedLevel3Category(category);
    setSelectedLevel4Category('');
  }, []);

  const handleLevel4CategoryChange = useCallback((category: string) => {
    setSelectedLevel4Category(category);
  }, []);

  // 기간 선택 핸들러
  const handlePeriodChange = useCallback((period: string) => {
    setSelectedPeriod(period as Period);
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">자재 가격 조회</h1>
        </div>

        {/* 가격 변동률 지표 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-800">최대 상승률</CardTitle>
              <div className="text-green-600">📈</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                {summaryLoading || level1Loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  '+12.5%'
                )}
              </div>
              <p className="text-xs text-green-600 mt-1">
                SUS304 (지난달 대비)
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-800">최대 하락률</CardTitle>
              <div className="text-red-600">📉</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">
                {summaryLoading || level1Loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  '-8.2%'
                )}
              </div>
              <p className="text-xs text-red-600 mt-1">
                AL6061 (지난달 대비)
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-800">평균 변동률</CardTitle>
              <div className="text-blue-600">📊</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                {summaryLoading || level1Loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  '₩2.4M'
                )}
              </div>
              <p className="text-xs text-blue-600 mt-1">
                전체 자재 평균
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-800">변동성 지수</CardTitle>
              <div className="text-purple-600">⚡</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">
                {summaryLoading || level1Loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  '156'
                )}
              </div>
              <p className="text-xs text-purple-600 mt-1">
                시장 변동성 수준
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 조회 조건 */}
        <Card className="border border-gray-200">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* 자재 선택 영역 */}
              <div className="flex flex-wrap gap-3">
                <Select value={selectedLevel1Category} onValueChange={handleLevel1CategoryChange}>
                  <SelectTrigger className="h-10 min-w-[120px] border-2 border-blue-200 hover:border-blue-400 transition-all duration-200 bg-white shadow-sm">
                    <SelectValue placeholder="1단계" />
                  </SelectTrigger>
                  <SelectContent>
                    {level1Categories?.map((category: any, index: number) => (
                      <SelectItem key={`${category.name || category}-${index}`} value={category.name || category} className="hover:bg-blue-50">
                        {category.name || category}
                      </SelectItem>
                    )) || []}
                  </SelectContent>
                </Select>

                <Select 
                  value={selectedLevel2Category} 
                  onValueChange={handleLevel2CategoryChange}
                  disabled={!selectedLevel1Category}
                >
                  <SelectTrigger className="h-10 min-w-[120px] border-2 border-blue-200 hover:border-blue-400 transition-all duration-200 bg-white shadow-sm disabled:opacity-50">
                    <SelectValue placeholder="2단계" />
                  </SelectTrigger>
                  <SelectContent>
                    {level2Categories?.map((category: any, index: number) => (
                      <SelectItem key={`${category.name || category}-${index}`} value={category.name || category} className="hover:bg-blue-50">
                        {category.name || category}
                      </SelectItem>
                    )) || []}
                  </SelectContent>
                </Select>

                <Select 
                  value={selectedLevel3Category} 
                  onValueChange={handleLevel3CategoryChange}
                  disabled={!selectedLevel2Category}
                >
                  <SelectTrigger className="h-10 min-w-[120px] border-2 border-blue-200 hover:border-blue-400 transition-all duration-200 bg-white shadow-sm disabled:opacity-50">
                    <SelectValue placeholder="3단계" />
                  </SelectTrigger>
                  <SelectContent>
                    {level3Categories?.map((category: any, index: number) => (
                      <SelectItem key={`${category.name || category}-${index}`} value={category.name || category} className="hover:bg-blue-50">
                        {category.name || category}
                      </SelectItem>
                    )) || []}
                  </SelectContent>
                </Select>

                {level4Categories && level4Categories.length > 0 && (
                  <Select 
                    value={selectedLevel4Category} 
                    onValueChange={handleLevel4CategoryChange}
                    disabled={!selectedLevel3Category}
                  >
                    <SelectTrigger className="h-10 min-w-[120px] border-2 border-blue-200 hover:border-blue-400 transition-all duration-200 bg-white shadow-sm disabled:opacity-50">
                      <SelectValue placeholder="4단계" />
                    </SelectTrigger>
                    <SelectContent>
                      {level4Categories.map((category: string | { name: string }, index: number) => {
                        const categoryName = typeof category === 'string' ? category : (category?.name || String(category));
                        return (
                          <SelectItem key={`${categoryName}-${index}`} value={categoryName} className="hover:bg-blue-50">
                            {categoryName}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* 기간 선택 드롭다운 */}
              <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                <SelectTrigger className="h-10 w-20 border-2 border-green-200 hover:border-green-400 transition-all duration-200 bg-white shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily" className="hover:bg-green-50">일간</SelectItem>
                  <SelectItem value="weekly" className="hover:bg-green-50">주간</SelectItem>
                  <SelectItem value="monthly" className="hover:bg-green-50">월간</SelectItem>
                  <SelectItem value="yearly" className="hover:bg-green-50">연간</SelectItem>
                </SelectContent>
              </Select>
                
              {/* 날짜 선택 영역 */}
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10 w-36 border-2 border-blue-200 hover:border-blue-400 transition-colors bg-white shadow-sm"
                />
                <span className="text-gray-500 font-medium">~</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10 w-36 border-2 border-blue-200 hover:border-blue-400 transition-colors bg-white shadow-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 자재 선택 영역 - 간소화된 UI */}
        {selectedLevel4Category && (
          <Card className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`material-${selectedLevel4Category}`}
                    checked={selectedMaterialsForChart.includes(selectedLevel4Category)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedMaterialsForChart(prev => 
                          prev.includes(selectedLevel4Category) 
                            ? prev 
                            : [...prev, selectedLevel4Category]
                        );
                      } else {
                        setSelectedMaterialsForChart(prev => 
                          prev.filter(m => m !== selectedLevel4Category)
                        );
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <Label htmlFor={`material-${selectedLevel4Category}`} className="text-sm font-medium">
                    {selectedLevel4Category}
                  </Label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedMaterialsForChart(prev => 
                      prev.filter(m => m !== selectedLevel4Category)
                    );
                  }}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  제거
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 차트 영역 */}
        <Card className="border border-gray-200">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-semibold text-gray-800">
                자재 가격 추이
                {selectedMaterialsForChart.length > 0 && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({selectedMaterialsForChart.length}개 자재 선택됨)
                  </span>
                )}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMaterialsForChart([])}
                  disabled={selectedMaterialsForChart.length === 0}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  전체 해제
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <div className="h-96 flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : chartError ? (
              <div className="h-96 flex items-center justify-center text-red-500">
                차트 데이터를 불러오는 중 오류가 발생했습니다.
              </div>
            ) : formattedChartData.length === 0 ? (
              <div className="h-96 flex items-center justify-center text-gray-500">
                표시할 데이터가 없습니다. 자재를 선택해주세요.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={formattedChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickFormatter={formatXAxisLabel}
                    angle={getXAxisAngle()}
                    textAnchor={getXAxisAngle() !== 0 ? "end" : "middle"}
                    height={getXAxisAngle() !== 0 ? 80 : 60}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickFormatter={(value) => value.toLocaleString()}
                    label={{ 
                      value: '가격 (원)', 
                      angle: -90, 
                      position: 'insideLeft',
                      style: { textAnchor: 'middle', fontSize: '12px', fontWeight: 'bold', fill: '#374151' }
                    }}
                  />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      value ? `${Number(value).toLocaleString()}원` : 'N/A', 
                      name
                    ]}
                    labelFormatter={formatDateLabel}
                    labelStyle={{ color: '#1f2937', fontWeight: 'bold' }}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="line"
                  />
                  {selectedMaterialsForChart.map((material, index) => (
                    !hiddenMaterials.has(material) && (
                      <Line
                        key={material}
                        type="monotone"
                        dataKey={material}
                        stroke={chartColors[index % chartColors.length]}
                        strokeWidth={2}
                        dot={{ r: 3, strokeWidth: 2 }}
                        activeDot={{ r: 5, strokeWidth: 2 }}
                        connectNulls={false}
                      />
                    )
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 요약 정보 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                자재 정보
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">선택된 자재:</span>
                  <span className="text-sm font-medium">
                    {selectedMaterialsForChart.length > 0 ? selectedMaterialsForChart.join(', ') : '없음'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">조회 기간:</span>
                  <span className="text-sm font-medium">
                    {selectedPeriod === 'daily' ? '일간' : 
                     selectedPeriod === 'weekly' ? '주간' : 
                     selectedPeriod === 'monthly' ? '월간' : '연간'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">데이터 포인트:</span>
                  <span className="text-sm font-medium">
                    {formattedChartData.length}개
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-600" />
                ASME 물성정보 & 가격정보
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedMaterialsForChart.length > 0 ? (
                  selectedMaterialsForChart.slice(0, 3).map((material, index) => {
                    // 실제 데이터에서 가져와야 하지만, 여기서는 예시 데이터 사용
                    const materialData = {
                      'SUS304': { price: 8500, density: 7.93, tensile: 520, yield: 205, elastic: 200, thermal: 16.2 },
                      'SUS316': { price: 9200, density: 8.0, tensile: 515, yield: 205, elastic: 200, thermal: 16.3 },
                      'AL6061': { price: 3200, density: 2.7, tensile: 310, yield: 276, elastic: 68.9, thermal: 167 },
                      'Carbon Steel': { price: 2800, density: 7.85, tensile: 400, yield: 250, elastic: 200, thermal: 50 }
                    };
                    
                    const data = materialData[material as keyof typeof materialData] || materialData['SUS304'];
                    
                    return (
                      <div key={material} className="border-b border-gray-100 pb-2 last:border-b-0">
                        <div className="font-medium text-sm text-gray-800 mb-1">{material}</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Current Price (원/kg):</span>
                            <span className="font-medium">
                              {(() => {
                                // 현재 가격 계산 로직
                                const currentData = formattedChartData.find(d => d[material] !== null);
                                const price = currentData?.[material];
                                return typeof price === 'number' ? price.toLocaleString() : 'N/A';
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-gray-500">자재를 선택해주세요</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-purple-600" />
                물성 정보
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedMaterialsForChart.length > 0 ? (
                  selectedMaterialsForChart.slice(0, 1).map((material) => {
                    const materialData = {
                      'SUS304': { density: 7.93, tensile: 520, yield: 205, elastic: 200, thermal: 16.2 },
                      'SUS316': { density: 8.0, tensile: 515, yield: 205, elastic: 200, thermal: 16.3 },
                      'AL6061': { density: 2.7, tensile: 310, yield: 276, elastic: 68.9, thermal: 167 },
                      'Carbon Steel': { density: 7.85, tensile: 400, yield: 250, elastic: 200, thermal: 50 }
                    };
                    
                    const data = materialData[material as keyof typeof materialData] || materialData['SUS304'];
                    
                    return (
                      <div key={material} className="space-y-2">
                        <div className="font-medium text-sm text-gray-800 mb-2">{material}</div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Density (g/cm³):</span>
                            <span className="font-medium">{data.density}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Tensile Strength (MPa):</span>
                            <span className="font-medium">{data.tensile}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Yield Strength (MPa):</span>
                            <span className="font-medium">{data.yield}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Elastic Modulus (GPa):</span>
                            <span className="font-medium">{data.elastic}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Thermal Conductivity (W/m·K):</span>
                            <span className="font-medium">{data.thermal}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-gray-500">자재를 선택해주세요</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 자재 계산기 */}
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-800">자재 계산기</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="length">길이 (mm)</Label>
                <Input id="length" type="number" placeholder="1000" className="border-gray-300" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="width">폭 (mm)</Label>
                <Input id="width" type="number" placeholder="100" className="border-gray-300" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="thickness">두께 (mm)</Label>
                <Input id="thickness" type="number" placeholder="10" className="border-gray-300" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="material-select">자재 선택</Label>
                <Select>
                  <SelectTrigger className="border-gray-300">
                    <SelectValue placeholder="자재 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sus304">SUS304 (7.93 g/cm³)</SelectItem>
                    <SelectItem value="sus316">SUS316 (8.0 g/cm³)</SelectItem>
                    <SelectItem value="al6061">AL6061 (2.7 g/cm³)</SelectItem>
                    <SelectItem value="carbon">Carbon Steel (7.85 g/cm³)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">0.79 kg</div>
                  <div className="text-sm text-gray-600">예상 중량</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">₩6,715</div>
                  <div className="text-sm text-gray-600">예상 가격</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">100 cm²</div>
                  <div className="text-sm text-gray-600">표면적</div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>길이 단위</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="단위 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mm">mm (밀리미터)</SelectItem>
                    <SelectItem value="cm">cm (센티미터)</SelectItem>
                    <SelectItem value="m">m (미터)</SelectItem>
                    <SelectItem value="inch">inch (인치)</SelectItem>
                    <SelectItem value="ft">ft (피트)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>중량 단위</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="단위 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mm">mm (밀리미터)</SelectItem>
                    <SelectItem value="cm">cm (센티미터)</SelectItem>
                    <SelectItem value="m">m (미터)</SelectItem>
                    <SelectItem value="inch">inch (인치)</SelectItem>
                    <SelectItem value="ft">ft (피트)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 자재 비교 테이블 */}
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-800">
              자재 비교 분석
              <span className="text-sm font-normal text-gray-500 ml-2">
                (선택한 자재 기반)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedMaterialsForChart.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left">자재명</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">현재가격 (원/kg)</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">밀도 (g/cm³)</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">인장강도 (MPa)</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">항복강도 (MPa)</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">탄성계수 (GPa)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMaterialsForChart.map((material, index) => {
                      const materialData = {
                        'SUS304': { price: 8500, density: 7.93, tensile: 520, yield: 205, elastic: 200 },
                        'SUS316': { price: 9200, density: 8.0, tensile: 515, yield: 205, elastic: 200 },
                        'AL6061': { price: 3200, density: 2.7, tensile: 310, yield: 276, elastic: 68.9 },
                        'Carbon Steel': { price: 2800, density: 7.85, tensile: 400, yield: 250, elastic: 200 }
                      };
                      
                      const data = materialData[material as keyof typeof materialData] || materialData['SUS304'];
                      const currentPrice = (() => {
                        const currentData = formattedChartData.find(d => d[material] !== null);
                        const price = currentData?.[material];
                        return typeof price === 'number' ? price : data.price;
                      })();
                      
                      return (
                        <tr key={material} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-300 px-4 py-2 font-medium">{material}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center">{currentPrice.toLocaleString()}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center">{data.density}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center">{data.tensile}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center">{data.yield}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center">{data.elastic}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                자재를 선택하면 비교 분석 테이블이 표시됩니다.
              </div>
            )}
          </CardContent>
        </Card>

        {/* 시장 전망 */}
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-800">시장 전망 및 분석</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">📊 시장 동향</h4>
                <p className="text-sm text-blue-700">• 글로벌 공급망 안정화로 인한 가격 조정 국면</p>
                <p className="text-sm text-blue-700">• 원자재 가격 상승으로 인한 전반적 가격 상승 압력</p>
                <p className="text-sm text-blue-700">• 환율 변동에 따른 수입 자재 가격 변동성 증가</p>
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2">📈 향후 전망</h4>
                <p><strong>• 가격 상승 예상:</strong> SUS 계열 (공급 부족)</p>
                <p><strong>• 가격 안정 예상:</strong> AL 계열 (수요 균형)</p>
                <p><strong>• 주의 필요:</strong> 국제 정세에 따른 급격한 변동 가능성</p>
              </div>
              
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-semibold text-yellow-800 mb-2">⚠️ 리스크 요인</h4>
                <p className="text-sm text-yellow-700">• 지정학적 리스크로 인한 공급망 차질</p>
                <p className="text-sm text-yellow-700">• 환율 급변동 시 수입 자재 가격 급등 가능성</p>
                <p className="text-sm text-yellow-700">• 계절적 수요 변동에 따른 단기 가격 변동</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default memo(MaterialsPage);