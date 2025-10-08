'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import MakeItFromComparison from '@/components/materials/MakeItFromComparison';
import { MakeItFromDatabase } from '@/types/makeItFrom';

export default function MakeItFromPage() {
  const [database, setDatabase] = useState<MakeItFromDatabase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDatabase = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // MakeItFrom.json 파일 로드
        const response = await fetch('/MakeItFrom.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 데이터 유효성 검사
        if (!Array.isArray(data)) {
          throw new Error('Invalid data format: expected array');
        }
        
        setDatabase(data);
      } catch (err) {
        console.error('Failed to load MakeItFrom database:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    loadDatabase();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">재료 데이터베이스를 로딩 중입니다...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            데이터베이스 로딩 중 오류가 발생했습니다: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!database) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            데이터베이스를 사용할 수 없습니다.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <MakeItFromComparison database={database} />
    </div>
  );
}