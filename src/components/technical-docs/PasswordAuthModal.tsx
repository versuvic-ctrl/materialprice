'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface PasswordAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
  title?: string;
  description?: string;
}

const PasswordAuthModal: React.FC<PasswordAuthModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title = '관리자 인증',
  description = '글을 작성하거나 수정하려면 비밀번호를 입력해주세요.',
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  // 모달이 열릴 때마다 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
      setAttempts(0);
      setShowPassword(false);
    }
  }, [isOpen]);

  // 비밀번호 입력 핸들러
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (error) setError(''); // 에러 메시지 클리어
  };

  // 엔터 키 핸들러
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && password.trim()) {
      handleSubmit();
    }
  };

  // 인증 시도
  const handleSubmit = async () => {
    if (!password.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 환경변수의 비밀번호와 비교
      const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
      const isValid = password === adminPassword;
      
      if (isValid) {
        // 인증 성공
        setPassword('');
        onSubmit(password);
        onClose();
      } else {
        // 인증 실패
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        if (newAttempts >= 3) {
          setError('비밀번호를 3회 잘못 입력했습니다. 잠시 후 다시 시도해주세요.');
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          setError(`비밀번호가 올바르지 않습니다. (${newAttempts}/3)`);
        }
        
        setPassword('');
      }
    } catch (error) {
      console.error('인증 중 오류:', error);
      setError('인증 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 취소 핸들러
  const handleCancel = () => {
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Lock className="h-6 w-6 text-blue-600" />
          </div>
          <DialogTitle className="text-lg font-semibold">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            {description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
          {/* 에러 메시지 */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 비밀번호 입력 */}
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={handlePasswordChange}
                onKeyPress={handleKeyPress}
                placeholder="비밀번호를 입력하세요"
                disabled={isLoading || attempts >= 3}
                className="pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* 시도 횟수 표시 */}
          {attempts > 0 && attempts < 3 && (
            <div className="text-xs text-gray-500 text-center">
              {3 - attempts}번 더 시도할 수 있습니다.
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !password.trim() || attempts >= 3}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  확인 중...
                </>
              ) : (
                '확인'
              )}
            </Button>
          </div>
        </form>

        {/* 보안 안내 */}
        <div className="text-xs text-gray-500 text-center mt-4 pt-4 border-t">
          <p>보안을 위해 인증 정보는 30분간 유지됩니다.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordAuthModal;