'use client';
import React, { useState, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminAuth({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password === process.env.ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      setError('비밀번호가 올바르지 않습니다.');
    }
  };

  if (isAuthenticated) return <>{children}</>;

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-96 mt-[-20vh]">
        <CardHeader>
          <CardTitle>관리자 인증</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input 
              type="password" 
              placeholder="비밀번호를 입력하세요"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
            <Button type="submit" className="w-full">접속</Button>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}