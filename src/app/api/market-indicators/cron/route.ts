import { NextRequest, NextResponse } from 'next/server';
import * as cron from 'node-cron';
import { redis } from '@/utils/redis'; // Redis 임포트 추가

let cronJobs: cron.ScheduledTask[] = [];

// 시장지표 데이터를 업데이트하는 함수
async function updateMarketIndicators() {
  try {
    console.log('시장지표 데이터 업데이트 시작:', new Date().toISOString());
    
    // 내부 API 호출로 시장지표 데이터 업데이트
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/market-indicators`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('시장지표 데이터 업데이트 성공:', data);
    } else {
      console.error('시장지표 데이터 업데이트 실패:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('시장지표 데이터 업데이트 중 오류:', error);
  }
}

// GET: 현재 cron job 상태 확인
export async function GET() {
  const status = cronJobs.map((job, index) => ({
    id: index,
    running: job.getStatus() === 'scheduled',
    destroyed: job.getStatus() === 'destroyed'
  }));

  return NextResponse.json({
    message: 'Cron job 상태',
    jobs: status,
    totalJobs: cronJobs.length
  });
}

// POST: cron job 시작
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'start') {
      // 기존 cron job이 있다면 정리
      cronJobs.forEach(job => {
        if (job.getStatus() === 'scheduled') {
          job.destroy();
        }
      });
      cronJobs = [];

      // 오전 8시 cron job (0 8 * * *)
      const morningJob = cron.schedule('0 8 * * *', async () => {
        console.log('오전 8시 시장지표 업데이트 실행');
        await updateMarketIndicators();
      }, {
        timezone: 'Asia/Seoul'
      });

      // 오후 3시 cron job (0 15 * * *)
      const afternoonJob = cron.schedule('0 15 * * *', async () => {
        console.log('오후 3시 시장지표 업데이트 실행');
        await updateMarketIndicators();
      }, {
        timezone: 'Asia/Seoul'
      });

      // cron job 시작
      morningJob.start();
      afternoonJob.start();

      cronJobs.push(morningJob, afternoonJob);

      return NextResponse.json({
        message: 'Cron job이 성공적으로 시작되었습니다.',
        schedule: ['오전 8시 (0 8 * * *)', '오후 3시 (0 15 * * *)'],
        timezone: 'Asia/Seoul'
      });

    } else if (action === 'stop') {
      // 모든 cron job 정지
      cronJobs.forEach(job => {
        if (job.getStatus() === 'scheduled') {
          job.destroy();
        }
      });
      cronJobs = [];

      return NextResponse.json({
        message: 'Cron job이 성공적으로 정지되었습니다.'
      });

    } else if (action === 'test') {
      // 테스트용 즉시 실행
      await updateMarketIndicators();
      
      return NextResponse.json({
        message: '시장지표 데이터 업데이트 테스트가 완료되었습니다.'
      });

    } else {
      return NextResponse.json(
        { error: '유효하지 않은 액션입니다. start, stop, test 중 하나를 선택하세요.' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Cron job 설정 중 오류:', error);
    return NextResponse.json(
      { error: 'Cron job 설정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: cron job 정지 및 정리
export async function DELETE() {
  try {
    cronJobs.forEach(job => {
      if (job.getStatus() === 'scheduled') {
        job.destroy();
      }
    });
    cronJobs = [];

    return NextResponse.json({
      message: '모든 cron job이 정리되었습니다.'
    });
  } catch (error) {
    console.error('Cron job 정리 중 오류:', error);
    return NextResponse.json(
      { error: 'Cron job 정리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}