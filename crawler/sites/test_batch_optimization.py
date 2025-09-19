import asyncio
import sys
import os
import time
from datetime import datetime
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from kpi_crawler import KpiCrawler
from data_processor import KpiDataProcessor

def test_batch_optimization():
    """최적화된 배치 중복 검사 기능을 테스트합니다."""
    
    print("=" * 80)
    print("🚀 배치 중복 검사 최적화 테스트 시작")
    print("=" * 80)
    
    # 테스트 대상 소분류 선택 (기존 데이터가 있는 소분류)
    major_name = "공통자재"
    middle_name = "봉강"
    sub_name = "이형철근(이형봉강)(1)"
    
    print(f"📋 테스트 대상:")
    print(f"   대분류: {major_name}")
    print(f"   중분류: {middle_name}")
    print(f"   소분류: {sub_name}")
    print()
    
    # API 호출 횟수 카운터 초기화
    api_call_count = 0
    
    # DataProcessor 생성 및 API 호출 모니터링 설정
    processor = KpiDataProcessor()
    
    # 전역 supabase 클라이언트 import
    from data_processor import supabase
    
    # 원본 supabase.table 메서드를 래핑하여 API 호출 카운트
    original_table = supabase.table
    def count_api_calls(table_name):
        nonlocal api_call_count
        table_obj = original_table(table_name)
        
        # select 메서드 래핑
        original_select = table_obj.select
        def wrapped_select(*args, **kwargs):
            nonlocal api_call_count
            api_call_count += 1
            print(f"   📡 API 호출 #{api_call_count}: SELECT from {table_name}")
            return original_select(*args, **kwargs)
        table_obj.select = wrapped_select
        
        # insert 메서드 래핑
        original_insert = table_obj.insert
        def wrapped_insert(*args, **kwargs):
            nonlocal api_call_count
            api_call_count += 1
            print(f"   📡 API 호출 #{api_call_count}: INSERT to {table_name}")
            return original_insert(*args, **kwargs)
        table_obj.insert = wrapped_insert
        
        return table_obj
    
    # supabase 객체를 직접 수정하여 API 호출 모니터링
    supabase.table = count_api_calls
    
    print("🔍 1단계: 크롤링 실행 및 API 호출 모니터링")
    print("-" * 50)
    
    # 크롤링 실행
    start_time = time.time()
    
    async def run_test_crawling():
        crawler = KpiCrawler(
            target_major=major_name,
            target_middle=middle_name, 
            target_sub=sub_name,
            crawl_mode="single",
            max_concurrent=1
        )
        await crawler.run()
    
    # 크롤링 실행
    asyncio.run(run_test_crawling())
    
    end_time = time.time()
    execution_time = end_time - start_time
    
    print()
    print("📊 2단계: 테스트 결과 분석")
    print("-" * 50)
    print(f"⏱️  실행 시간: {execution_time:.2f}초")
    print(f"📡 총 API 호출 횟수: {api_call_count}회")
    
    # 기대 호출 횟수 계산 (최적화된 방식)
    # 1. 전체 소분류 데이터 조회: 1회
    # 2. 청크별 배치 저장: 예상 1-3회 (데이터량에 따라)
    expected_calls = 4  # 여유있게 설정
    
    print()
    print("🎯 3단계: 최적화 효과 검증")
    print("-" * 50)
    
    if api_call_count <= expected_calls:
        print(f"✅ 최적화 성공! API 호출이 {expected_calls}회 이하로 감소")
        print(f"   기존 방식 예상: 50-100회")
        print(f"   최적화된 방식: {api_call_count}회")
        optimization_rate = ((50 - api_call_count) / 50) * 100
        print(f"   최적화율: {optimization_rate:.1f}% 개선")
    else:
        print(f"⚠️  최적화 미흡: API 호출이 {api_call_count}회 발생")
        print(f"   목표: {expected_calls}회 이하")
        print(f"   추가 최적화 필요")
    
    print()
    print("🔍 4단계: 중복 처리 검증")
    print("-" * 50)
    
    # 중복 검사 테스트를 위해 동일한 크롤링 재실행
    print("동일한 소분류 재크롤링으로 중복 처리 테스트...")
    
    api_call_count = 0  # 카운터 리셋
    start_time = time.time()
    
    # 두 번째 크롤링 실행
    asyncio.run(run_test_crawling())
    
    end_time = time.time()
    second_execution_time = end_time - start_time
    
    print(f"⏱️  두 번째 실행 시간: {second_execution_time:.2f}초")
    print(f"📡 두 번째 API 호출 횟수: {api_call_count}회")
    
    if api_call_count <= 2:
        print("✅ 중복 처리 성공! 기존 데이터 감지로 API 호출 최소화")
    else:
        print("⚠️  중복 처리 확인 필요: 예상보다 많은 API 호출 발생")
    
    print()
    print("=" * 80)
    print("🎉 배치 중복 검사 최적화 테스트 완료")
    print("=" * 80)
    
    # 최종 결과 요약
    print("📋 최종 결과 요약:")
    print(f"   첫 번째 크롤링: {api_call_count}회 API 호출")
    print(f"   두 번째 크롤링: {api_call_count}회 API 호출")
    print(f"   총 실행 시간: {execution_time + second_execution_time:.2f}초")
    
    if api_call_count <= expected_calls:
        print("   ✅ 최적화 목표 달성!")
    else:
        print("   ⚠️  추가 최적화 검토 필요")

if __name__ == "__main__":
    test_batch_optimization()