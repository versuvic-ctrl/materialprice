import sys
import asyncio
sys.path.append('./crawler/sites')
from data_processor import KpiDataProcessor

async def test_region_processing():
    # 실제 KPI 크롤러 데이터 구조에 맞는 테스트 데이터 생성
    test_raw_data = [{
        'major_category_name': '공통자재',
        'middle_category_name': '봉강',
        'sub_category_name': '스파이럴철근',
        'spec_data': [
            {
                'specification_name': 'D10',
                'unit': '원/톤',
                'prices': [
                    {'region': '서울', 'date': '2024-12-01', 'price': '1,000'},
                    {'region': '공통지역', 'date': '2024-12-01', 'price': '1,100'},
                    {'region': '', 'date': '2024-12-01', 'price': '1,200'},
                    {'region': None, 'date': '2024-12-01', 'price': '1,300'},
                    {'region': '전국', 'date': '2024-12-01', 'price': '1,400'}
                ]
            }
        ]
    }]

    processor = KpiDataProcessor()
    processor.raw_data_list = test_raw_data
    
    processed_data = await processor.process_data('공통자재', '봉강', '스파이럴철근')

    print('처리된 데이터:')
    for item in processed_data:
        print(f'지역: {item.get("region", "N/A")}, 가격: {item.get("price", "N/A")}, 규격: {item.get("specification", "N/A")}')

if __name__ == "__main__":
    asyncio.run(test_region_processing())