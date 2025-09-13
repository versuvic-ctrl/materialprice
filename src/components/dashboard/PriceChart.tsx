'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO, startOfWeek, startOfMonth, startOfYear, addWeeks, addMonths, addYears, isAfter, isBefore } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Period, PERIOD_OPTIONS } from '@/types/period';

interface PriceData {
  date: string;
  [key: string]: string | number;
}

interface MaterialSeries {
  material: string;
  color: string;
  visible: boolean;
}

interface PriceChartProps {
  data: PriceData[];
  materials?: string[];
  title?: string;
  height?: number;
}

const DEFAULT_MATERIALS = [
  '시멘트', '레미콘', '철근', '형강', '동파이프', '아연도강판'
];

const MATERIAL_COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff',
  '#00ffff', '#ffff00', '#ff0000', '#0000ff', '#800080', '#008000'
];

export default function PriceChart({ 
  data, 
  materials = DEFAULT_MATERIALS, 
  title = "자재 가격 추이", 
  height = 400 
}: PriceChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('monthly');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [materialSeries, setMaterialSeries] = useState<MaterialSeries[]>([]);

  // Initialize material series
  useEffect(() => {
    const series = materials.map((material, index) => ({
      material,
      color: MATERIAL_COLORS[index % MATERIAL_COLORS.length],
      visible: true,
    }));
    setMaterialSeries(series);
  }, [materials]);

  // Initialize date range based on data
  useEffect(() => {
    if (data.length > 0) {
      const dates = data.map(d => d.date).sort();
      if (!startDate) setStartDate(dates[0]);
      if (!endDate) setEndDate(dates[dates.length - 1]);
    }
  }, [data, startDate, endDate]);

  // Process and aggregate data based on selected period
  const processedData = useMemo(() => {
    if (!data.length || !startDate || !endDate) return [];

    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    // Generate complete period range based on selected period
    const generatePeriodRange = () => {
      const periods: string[] = [];
      let current = start;
      
      switch (selectedPeriod) {
        case 'weekly':
          current = startOfWeek(start, { weekStartsOn: 1 });
          while (!isAfter(current, end)) {
            periods.push(format(current, 'yyyy-MM-dd'));
            current = addWeeks(current, 1);
          }
          break;
        case 'monthly':
          current = startOfMonth(start);
          while (!isAfter(current, end)) {
            periods.push(format(current, 'yyyy-MM-dd'));
            current = addMonths(current, 1);
          }
          break;
        case 'yearly':
          current = startOfYear(start);
          while (!isAfter(current, end)) {
            periods.push(format(current, 'yyyy-MM-dd'));
            current = addYears(current, 1);
          }
          break;
        default:
          // For custom, just use filtered data
          return data.filter(item => {
            const itemDate = item.date;
            return itemDate >= startDate && itemDate <= endDate;
          });
      }
      
      return periods;
    };

    const periodRange = generatePeriodRange();
    if (selectedPeriod === 'custom') return periodRange as any;

    // Group data by period
    const groupedData: { [key: string]: { [material: string]: number[] } } = {};

    // Initialize all periods
    periodRange.forEach(period => {
      groupedData[period] = {};
    });

    // Filter and group actual data
    const filteredData = data.filter(item => {
      const itemDate = item.date;
      return itemDate >= startDate && itemDate <= endDate;
    });

    filteredData.forEach(item => {
      const date = parseISO(item.date);
      let periodKey: string;

      switch (selectedPeriod) {
        case 'weekly':
          periodKey = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
          break;
        case 'monthly':
          periodKey = format(startOfMonth(date), 'yyyy-MM-dd');
          break;
        case 'yearly':
          periodKey = format(startOfYear(date), 'yyyy-MM-dd');
          break;
        default:
          periodKey = item.date;
      }

      if (groupedData[periodKey]) {
        materials.forEach(material => {
          const price = Number(item[material]);
          if (!isNaN(price)) {
            if (!groupedData[periodKey][material]) {
              groupedData[periodKey][material] = [];
            }
            groupedData[periodKey][material].push(price);
          }
        });
      }
    });

    // Calculate averages and create final data
    const result = periodRange.map(periodKey => {
      const item: PriceData = { date: periodKey };
      
      materials.forEach(material => {
        const prices = groupedData[periodKey]?.[material] || [];
        if (prices.length > 0) {
          const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
          item[material] = Math.round(average);
        } else {
          // No data for this period, set to null to break line
          item[material] = null;
        }
      });
      
      return item;
    });

    return result;
  }, [data, selectedPeriod, startDate, endDate, materials]);

  const toggleMaterial = (material: string) => {
    setMaterialSeries(prev => 
      prev.map(series => 
        series.material === material 
          ? { ...series, visible: !series.visible }
          : series
      )
    );
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('ko-KR').format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold">{`날짜: ${formatDateLabel(label)}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.dataKey}: ${formatPrice(entry.value)}원`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const handlePeriodClick = (period: Period) => {
    setSelectedPeriod(period);
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      switch (selectedPeriod) {
        case 'weekly':
          const weekNumber = Math.ceil((date.getDate() - startOfMonth(date).getDate() + 1) / 7);
          return `${format(date, 'yyyy년 MM월', { locale: ko })} ${weekNumber}주`;
        case 'monthly':
          return format(date, 'yyyy년 MM월', { locale: ko });
        case 'yearly':
          return format(date, 'yyyy년', { locale: ko });
        default:
          return format(date, 'yyyy-MM-dd');
      }
    } catch {
      return dateStr;
    }
  };

  const formatXAxisLabel = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      switch (selectedPeriod) {
        case 'weekly':
          const weekNumber = Math.ceil((date.getDate() - startOfMonth(date).getDate() + 1) / 7);
          return `${format(date, 'MM', { locale: ko })}월${weekNumber}주`;
        case 'monthly':
          return format(date, 'yyyy/MM');
        case 'yearly':
          return format(date, 'yyyy');
        default:
          return format(date, 'MM/dd');
      }
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-800">{title}</h3>
      </div>

      {/* Date Range Picker and Period Buttons */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Date Range Picker */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">기간:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded text-sm"
          />
          <span className="text-gray-500">~</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded text-sm"
          />
        </div>

        {/* Period Selection Buttons */}
        <div className="flex gap-2">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handlePeriodClick(option.value)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                selectedPeriod === option.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Material Toggle Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {materialSeries.map((series) => (
          <button
            key={series.material}
            onClick={() => toggleMaterial(series.material)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              series.visible
                ? 'text-white'
                : 'bg-gray-100 text-gray-400'
            }`}
            style={{
              backgroundColor: series.visible ? series.color : undefined,
            }}
          >
            {series.material}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height }}>
        {processedData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatXAxisLabel}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                tickFormatter={formatPrice}
                domain={['dataMin - 1000', 'dataMax + 1000']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {materialSeries
                .filter(series => series.visible)
                .map((series) => (
                  <Line
                    key={series.material}
                    type="monotone"
                    dataKey={series.material}
                    stroke={series.color}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls={false}
                  />
                ))
              }
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            선택한 기간에 유효한 데이터가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}