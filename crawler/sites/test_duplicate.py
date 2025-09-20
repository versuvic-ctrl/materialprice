import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from data_processor import KpiDataProcessor

def test_duplicate_check():
    """수정된 중복 검사 로직을 테스트합니다."""
    
    # 테스트 대상
    major_name = "공통자재"
    middle_name = "봉강"
    sub_name = "이형철근(이형봉강)(1)"
    spec_name = "고장력철근(하이바)(SD 400) -  D10㎜, 0.560 - SD철근"
    
    print(f"테스트 대상:")
    print(f"  대분류: {major_name}")
    print(f"  중분류: {middle_name}")
    print(f"  소분류: {sub_name}")
    print(f"  규격: {spec_name}")
    print()
    
    # DataProcessor 생성
    processor = KpiDataProcessor()
    
    # 스마트 중복 검사 실행
    result = processor.check_existing_data_smart(
        major_name, middle_name, sub_name, spec_name
    )
    
    print("스마트 분석 결과:")
    print(f"  has_data: {result['has_data']}")
    print(f"  existing_combinations: {len(result['existing_combinations'])}개")
    print(f"  existing_dates: {len(result['existing_dates'])}개")
    print(f"  existing_units: {len(result['existing_units'])}개")
    print()
    
    # 샘플 조합 출력
    if result['existing_combinations']:
        print("기존 조합 샘플 (처음 5개):")
        for i, combo in enumerate(list(result['existing_combinations'])[:5]):
            print(f"  {i+1}. {combo}")
        print()
    
    # 테스트용 새 데이터 생성
    test_date = "2024-01-15"
    test_region = "전국"
    test_price = "850000"
    test_combination = (test_date, test_region, test_price, spec_name)
    
    print(f"테스트 조합: {test_combination}")
    print(f"중복 여부: {test_combination in result['existing_combinations']}")
    
    # 실제 존재하는 조합으로 테스트
    if result['existing_combinations']:
        existing_combo = list(result['existing_combinations'])[0]
        print(f"기존 조합: {existing_combo}")
        print(f"중복 여부: {existing_combo in result['existing_combinations']}")

if __name__ == "__main__":
    test_duplicate_check()