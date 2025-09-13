'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Play, Clock, Database, TrendingUp, AlertCircle } from 'lucide-react';
import Layout from '@/components/layout/Layout';

interface CrawlerStatus {
  is_running: boolean;
  last_crawl_results: Record<string, unknown>;
  total_crawls_today: number;
  next_crawl_times: {
    next_crawl: string;
    following_crawl: string;
    current_time: string;
  };
}

interface CrawlHistory {
  last_updated: string;
  total_crawls: number;
  history: Array<{
    timestamp: string;
    results: {
      total_materials_collected?: number;
      results_by_category?: Record<string, unknown>;
      [key: string]: unknown;
    };
    duration: number;
  }>;
}

export default function AdminPage() {
  const [status, setStatus] = useState<CrawlerStatus | null>(null);
  const [history, setHistory] = useState<CrawlHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [manualRunning, setManualRunning] = useState(false);

  const fetchStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/crawler/status');
      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (error) {
      console.error('상태 조회 실패:', error);
      alert('크롤러 상태를 가져올 수 없습니다.');
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch('http://localhost:8000/crawler/history');
      const data = await response.json();
      if (data.success) {
        setHistory(data.data);
      }
    } catch (error) {
      console.error('히스토리 조회 실패:', error);
    }
  };

  const runManualCrawl = async () => {
    if (status?.is_running) {
      alert('크롤링이 이미 실행 중입니다.');
      return;
    }

    setManualRunning(true);
    alert('수동 크롤링을 시작합니다...');

    try {
      const response = await fetch('http://localhost:8000/crawler/run-manual', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        alert('크롤링이 성공적으로 완료되었습니다!');
        await fetchStatus();
        await fetchHistory();
      } else {
        alert(data.message || '크롤링 실행에 실패했습니다.');
      }
    } catch (error) {
      console.error('수동 크롤링 실패:', error);
      alert('크롤링 실행 중 오류가 발생했습니다.');
    } finally {
      setManualRunning(false);
    }
  };

  const refreshData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStatus(), fetchHistory()]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshData();
    
    // 30초마다 상태 업데이트
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };



  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">데이터를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <Layout title="크롤링 관리자">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">크롤링 관리자</h1>
          <p className="text-muted-foreground mt-2">
            KPI 자재 가격 크롤링 시스템 관리 및 모니터링
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={refreshData} 
            className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </button>
          <button 
            onClick={runManualCrawl} 
            disabled={status?.is_running || manualRunning}
            className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <Play className="h-4 w-4 mr-2" />
            {manualRunning ? '실행 중...' : '수동 실행'}
          </button>
        </div>
      </div>

      {/* 현재 상태 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow border">
          <div className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <h3 className="text-sm font-medium">크롤러 상태</h3>
            <AlertCircle className="h-4 w-4 text-gray-500" />
          </div>
          <div className="p-4 pt-0">
            <div className="text-2xl font-bold">
              {status ? (
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  status.is_running 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {status.is_running ? '실행 중' : '대기 중'}
                </span>
              ) : '알 수 없음'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border">
          <div className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <h3 className="text-sm font-medium">오늘 실행 횟수</h3>
            <TrendingUp className="h-4 w-4 text-gray-500" />
          </div>
          <div className="p-4 pt-0">
            <div className="text-2xl font-bold">
              {status?.total_crawls_today || 0}회
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border">
          <div className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <h3 className="text-sm font-medium">다음 실행</h3>
            <Clock className="h-4 w-4 text-gray-500" />
          </div>
          <div className="p-4 pt-0">
            <div className="text-sm font-bold">
              {status?.next_crawl_times?.next_crawl ? 
                formatDateTime(status.next_crawl_times.next_crawl) : 
                '예정 없음'
              }
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border">
          <div className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <h3 className="text-sm font-medium">총 크롤링 횟수</h3>
            <Database className="h-4 w-4 text-gray-500" />
          </div>
          <div className="p-4 pt-0">
            <div className="text-2xl font-bold">
              {history?.total_crawls || 0}회
            </div>
          </div>
        </div>
      </div>

      {/* 스케줄 정보 */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">크롤링 스케줄</h2>
          <p className="text-gray-600 mt-1">
            자동 크롤링 실행 일정 및 다음 예정 시간
          </p>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">정기 스케줄</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>• 매일 오전 6:00</div>
                  <div>• 매일 오후 9:00</div>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">다음 예정</h4>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="font-medium">다음 실행:</span>{' '}
                    {status?.next_crawl_times?.next_crawl ? 
                      formatDateTime(status.next_crawl_times.next_crawl) : 
                      '예정 없음'
                    }
                  </div>
                  <div>
                    <span className="font-medium">그 다음:</span>{' '}
                    {status?.next_crawl_times?.following_crawl ? 
                      formatDateTime(status.next_crawl_times.following_crawl) : 
                      '예정 없음'
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 최근 크롤링 히스토리 */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">최근 크롤링 히스토리</h2>
          <p className="text-gray-600 mt-1">
            최근 실행된 크롤링 작업의 결과 및 통계
          </p>
        </div>
        <div className="p-6">
          {history?.history && history.history.length > 0 ? (
            <div className="space-y-4">
              {history.history.slice(-5).reverse().map((item, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">
                      {formatDateTime(item.timestamp)}
                    </div>
                    <span className="px-2 py-1 border rounded text-xs">
                      {item.duration.toFixed(1)}초
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    수집된 자재: {item.results?.total_materials_collected || 0}개
                  </div>
                  {item.results?.results_by_category && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-600 mb-1">
                        카테고리별 결과:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(item.results.results_by_category).map(([category, result]) => {
                          const resultObj = result as { saved_to_db?: boolean };
                          return (
                            <span 
                              key={category} 
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                resultObj.saved_to_db
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {category}: {resultObj.saved_to_db ? '저장됨' : '실패'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600">
              아직 크롤링 히스토리가 없습니다.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}