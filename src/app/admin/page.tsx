'use client';

import React from 'react';
import Layout from '@/components/layout/Layout';
import AdminAuth from '@/components/auth/AdminAuth'; // 비밀번호 인증은 그대로 유지
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeBracketIcon, ClockIcon, PlayIcon, ChartBarIcon } from '@heroicons/react/24/outline';

// GitHub 저장소 주소를 본인의 것으로 변경해주세요.
const GITHUB_REPO_URL = "https://github.com/your-username/materials-dashboard";

const AdminPage: React.FC = () => {
  return (
    <AdminAuth>
      <Layout title="관리자">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">크롤링 관리 대시보드</h1>
            <p className="text-gray-600 mt-1">
              이 시스템은 GitHub Actions를 통해 자동으로 실행됩니다.
            </p>
          </div>

          <Tabs defaultValue="status" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="status">실행 및 모니터링</TabsTrigger>
              <TabsTrigger value="schedule">스케줄 관리</TabsTrigger>
            </TabsList>

            <TabsContent value="status" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <ChartBarIcon className="w-5 h-5" />
                    <span>실행 기록 및 모니터링</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-gray-700">
                    모든 크롤링 작업의 성공/실패 여부와 상세 실행 로그는 GitHub Actions 페이지에서 직접 확인할 수 있습니다.
                  </p>
                  <a href={`${GITHUB_REPO_URL}/actions`} target="_blank" rel="noopener noreferrer">
                    <Button>
                      <ChartBarIcon className="w-4 h-4 mr-2" />
                      GitHub Actions 모니터링 페이지로 이동
                    </Button>
                  </a>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <PlayIcon className="w-5 h-5" />
                    <span>수동으로 지금 실행하기</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-gray-700">
                    정해진 스케줄과 상관없이 크롤러를 즉시 실행하고 싶을 경우, GitHub Actions 페이지에서 수동으로 워크플로우를 실행할 수 있습니다.
                  </p>
                   <a href={`${GITHUB_REPO_URL}/actions/workflows/crawler.yml`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline">
                       <PlayIcon className="w-4 h-4 mr-2" />
                      &apos;Run workflow&apos; 버튼으로 수동 실행
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schedule">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <ClockIcon className="w-5 h-5" />
                    <span>크롤링 스케줄 변경</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-2 text-gray-700">
                    크롤링 실행 시간은 코드에 직접 설정되어 있습니다. 스케줄을 변경하려면 아래 파일을 수정하고 GitHub에 push해야 합니다.
                  </p>
                  <div className="p-3 my-2 bg-gray-100 rounded-md font-mono text-sm">
                    .github/workflows/crawler.yml
                  </div>
                  <p className="mb-4 text-gray-700">
                    파일 내의 `cron` 값을 수정하여 실행 주기를 변경할 수 있습니다. (시간은 UTC 기준입니다.)
                  </p>
                  <a href={`${GITHUB_REPO_URL}/blob/main/.github/workflows/crawler.yml`} target="_blank" rel="noopener noreferrer">
                    <Button>
                      <CodeBracketIcon className="w-4 h-4 mr-2" />
                      스케줄 설정 파일 보기
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </Layout>
    </AdminAuth>
  );
};

export default AdminPage;