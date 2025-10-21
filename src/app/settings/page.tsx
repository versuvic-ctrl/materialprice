'use client';

import React from 'react';
import { AdminAuth } from '@/components/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartBarIcon, PlayIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { clearRedisCache } from './actions';

// ⛔️ 여기를 본인의 GitHub 저장소 주소로 꼭 변경해주세요!
const GITHUB_REPO_URL = "https://github.com/your-username/materials-dashboard";

const SettingsPage: React.FC = () => {
  return (
    <AdminAuth>
      <div className="space-y-6">
          <h1 className="text-2xl font-bold">애플리케이션 설정</h1>
          <p className="text-gray-600">애플리케이션의 다양한 설정을 관리할 수 있습니다.</p>
          
          <Card>
            <CardHeader><CardTitle>실행 기록 및 모니터링</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-4">모든 크롤링 작업의 성공/실패 여부와 상세 로그는 GitHub Actions 페이지에서 직접 확인합니다.</p>
              <a href={`${GITHUB_REPO_URL}/actions`} target="_blank" rel="noopener noreferrer">
                <Button><ChartBarIcon className="w-4 h-4 mr-2" />모니터링 페이지로 이동</Button>
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>수동으로 지금 실행하기</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-4">정해진 시간과 상관없이 크롤러를 즉시 실행하고 싶을 경우, 아래 페이지에서 &apos;Run workflow&apos; 버튼을 누르세요.</p>
               <a href={`${GITHUB_REPO_URL}/actions/workflows/crawler.yml`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline"><PlayIcon className="w-4 h-4 mr-2" />수동 실행 페이지로 이동</Button>
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>스케줄 변경</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-2">실행 시간 변경은 코드 수정이 필요합니다. 아래 설정 파일의 `cron` 값을 수정한 후 GitHub에 push하세요. (시간은 UTC 기준)</p>
              <div className="p-2 my-2 bg-gray-100 rounded-md font-mono text-sm">.github/workflows/crawler.yml</div>
              <a href={`${GITHUB_REPO_URL}/blob/main/.github/workflows/crawler.yml`} target="_blank" rel="noopener noreferrer">
                <Button><CodeBracketIcon className="w-4 h-4 mr-2" />스케줄 설정 파일 보기</Button>
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>캐시 관리</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-4">애플리케이션의 캐시 데이터를 관리합니다. 캐시를 초기화하면 최신 데이터를 다시 불러옵니다.</p>
              <Button onClick={async () => {
                const result = await clearRedisCache();
                if (result.success) {
                  toast.success(result.message);
                } else {
                  toast.error(result.message);
                }
              }}>
                <ChartBarIcon className="w-4 h-4 mr-2" />캐시 완전 초기화
              </Button>
            </CardContent>
          </Card>
        </div>
    </AdminAuth>
  );
};

export default SettingsPage;