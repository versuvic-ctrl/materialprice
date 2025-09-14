import os
import json
import re
import pandas as pd
from datetime import datetime
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# 환경변수 로드
load_dotenv("../../.env.local")

# Supabase 클라이언트 초기화
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def log(message: str, level: str = "INFO"):
    """실행 과정 로그를 출력하는 함수
    
    Args:
        message: 로그 메시지
        level: 로그 레벨 (INFO, SUCCESS, ERROR, SUMMARY)
    """
    # 로그 레벨별 출력 제어
    if level == "SUMMARY":
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ✓ {message}")
    elif level == "ERROR":
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ✗ {message}")
    elif level == "SUCCESS":
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ✓ {message}")
    else:  # INFO
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")


class BaseDataProcessor(ABC):
    """모든 사이트별 데이터 처리기의 기본 클래스"""
    
    def __init__(self):
        self.raw_data_list: List[Dict[str, Any]] = []
        self.processed_data_list: List[Dict[str, Any]] = []
    
    def add_raw_data(self, data: Dict[str, Any]):
        """파싱된 원본 데이터를 추가"""
        self.raw_data_list.append(data)
    
    @abstractmethod
    def transform_to_standard_format(self, raw_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """사이트별 원본 데이터를 표준 형식으로 변환하는 추상 메서드
        
        Args:
            raw_data: 사이트별 원본 데이터
            
        Returns:
            표준 형식으로 변환된 데이터 리스트
            각 항목은 다음 구조를 가져야 함:
            {
                'major_category': str,
                'middle_category': str, 
                'sub_category': str,
                'specification': str,
                'unit': str,
                'region': str,
                'date': str,  # YYYY-MM-DD 형식
                'price': int or None
            }
        """
        pass
    
    def to_dataframe(self) -> pd.DataFrame:
        """수집된 데이터를 표준 형식의 Pandas DataFrame으로 변환"""
        if not self.raw_data_list:
            return pd.DataFrame()
        
        self.processed_data_list = []
        
        # 각 원본 데이터를 표준 형식으로 변환
        for raw_item in self.raw_data_list:
            transformed_items = self.transform_to_standard_format(raw_item)
            self.processed_data_list.extend(transformed_items)
        
        return pd.DataFrame(self.processed_data_list)
    
    def check_existing_data(self, major_category: str, middle_category: str, 
                           sub_category: str, specification: str, 
                           table_name: str = 'kpi_price_data') -> set:
        """Supabase에서 기존 데이터의 (날짜, 지역, 가격, 규격) 조합을 확인"""
        try:
            log(f"        - 중복 체크 시작: {major_category} > {middle_category} > {sub_category} > {specification}")
            response = supabase.table(table_name).select(
                'date, region, price, specification'
            ).eq(
                'major_category', major_category
            ).eq(
                'middle_category', middle_category
            ).eq(
                'sub_category', sub_category
            ).eq(
                'specification', specification
            ).execute()
            
            if response.data:
                existing_data = set()
                for item in response.data:
                    # 날짜, 지역, 가격, 규격 조합으로 중복 체크
                    combo = (item['date'], item['region'], str(item['price']), item['specification'])
                    existing_data.add(combo)
                log(f"        - 기존 데이터 발견: {len(existing_data)}개 (날짜-지역-가격-규격 조합)")
                return existing_data
            else:
                log("        - 기존 데이터 없음: 전체 추출 필요")
                return set()
                
        except Exception as e:
            log(f"        - 기존 데이터 확인 중 오류: {str(e)}")
            return set()  # 오류 시 전체 추출
    
    def filter_new_data_only(self, df: pd.DataFrame, table_name: str = 'kpi_price_data') -> pd.DataFrame:
        """기존 데이터와 비교하여 새로운 데이터만 필터링 (날짜-지역-가격-규격 조합 기준)"""
        if df.empty:
            return df
        
        # 카테고리별로 그룹화하여 한 번에 조회
        category_groups = df.groupby(['major_category', 'middle_category', 'sub_category', 'specification'])
        
        new_records = []
        total_records = len(df)
        skipped_count = 0
        
        for (major_cat, middle_cat, sub_cat, spec), group_df in category_groups:
            log(f"    - 중복 체크: {major_cat} > {middle_cat} > {sub_cat} > {spec}")
            
            # 해당 카테고리의 기존 데이터 조회 (한 번만)
            existing_data = self.check_existing_data(
                major_cat, middle_cat, sub_cat, spec, table_name
            )
            
            group_new_count = 0
            group_duplicate_count = 0
            
            # 그룹 내 모든 레코드에 대해 중복 체크
            for _, record in group_df.iterrows():
                record_key = (record['date'], record['region'], str(record['price']), record['specification'])
                if record_key not in existing_data:
                    new_records.append(record.to_dict())
                    group_new_count += 1
                else:
                    group_duplicate_count += 1
                    skipped_count += 1
                    log(f"        - 중복 SKIP: {record['date']} | {record['region']} | {record['price']}원 | {record['specification']}")
            
            log(f"        - 그룹 결과: 신규 {group_new_count}개, 중복 {group_duplicate_count}개")
        
        if new_records:
            log(f"📊 전체 {total_records}개 중 신규 {len(new_records)}개, 중복 {skipped_count}개")
        else:
            log(f"📊 전체 {total_records}개 모두 중복 - 저장할 데이터 없음")
        
        return pd.DataFrame(new_records)
    
    def save_to_supabase(self, df: pd.DataFrame, table_name: str, check_duplicates: bool = True):
        """DataFrame을 Supabase 테이블에 저장"""
        if df.empty:
            log("저장할 데이터가 없습니다.")
            return
        
        # 중복 체크가 활성화된 경우 새로운 데이터만 필터링
        if check_duplicates:
            df = self.filter_new_data_only(df, table_name)
            if df.empty:
                log("저장할 신규 데이터가 없습니다.")
                return
        
        try:
            records = df.to_dict(orient='records')
            # 유효하지 않은 데이터를 필터링
            valid_records = []
            for record in records:
                if self._is_valid_record(record):
                    # 날짜 형식 정규화
                    record['date'] = self._normalize_date(record['date'])
                    valid_records.append(record)
                else:
                    log(f"유효하지 않은 데이터 제외: {record}")
            
            if not valid_records:
                log("유효한 데이터가 없어 저장을 건너뜁니다.")
                return
            
            data, error = supabase.table(table_name).upsert(valid_records).execute()
            if error and error.message:
                log(f"❌ Supabase 저장 실패: {error.message}")
            else:
                record_count = len(valid_records)
                log(f"📊 {record_count}개 데이터 → '{table_name}' 테이블 저장 완료")
        except Exception as e:
            log(f"Supabase 저장 중 예외 발생: {e}")
    
    def _is_valid_record(self, record: Dict[str, Any]) -> bool:
        """레코드의 유효성을 검증"""
        required_fields = ['major_category', 'middle_category', 'sub_category', 
                          'specification', 'region', 'date']
        
        # 필수 필드 존재 확인
        for field in required_fields:
            if field not in record or not record[field]:
                return False
        
        # 날짜 유효성 검증
        if not self._is_valid_date_value(record['date']):
            return False
        
        # 가격 유효성 검증 (None 허용)
        price = record.get('price')
        if price is not None and not isinstance(price, (int, float)):
            return False
        
        return True
    
    def _is_valid_date_value(self, date_value: Any) -> bool:
        """날짜 값이 유효한지 검증하는 함수"""
        if date_value is None:
            return False
        
        # 문자열인 경우
        if isinstance(date_value, str):
            date_str = date_value.strip()
            
            # 빈 문자열 체크
            if not date_str:
                return False
            
            # 지역명 패턴 체크 (한국 지역명들)
            region_patterns = [
                '강원', '경기', '경남', '경북', '광주', '대구', '대전', '부산',
                '서울', '세종', '울산', '인천', '전남', '전북', '제주', '충남', '충북',
                '강①원', '강②원', '경①기', '경②기', '경①남', '경②남', '경①북', '경②북',
                '광①주', '광②주', '대①구', '대②구', '대①전', '대②전', '부①산', '부②산',
                '서①울', '서②울', '세①종', '세②종', '울①산', '울②산', '인①천', '인②천',
                '전①남', '전②남', '전①북', '전②북', '제①주', '제②주', '충①남', '충②남',
                '충①북', '충②북'
            ]
            
            # 지역명이 포함된 경우 날짜가 아님
            for region in region_patterns:
                if region in date_str:
                    return False
            
            # 기타 잘못된 값 체크
            invalid_chars = ['가', '①', '②', '격']
            if any(char in date_str for char in invalid_chars):
                return False
            
            # 날짜 형식 검증 (YYYY-MM-DD 또는 YYYY/MM/DD)
            date_pattern = r'^\d{4}[-/]\d{1,2}[-/]\d{1,2}$'
            return bool(re.match(date_pattern, date_str))
        
        # datetime 객체인 경우
        if hasattr(date_value, 'strftime'):
            return True
        
        return False
    
    def _normalize_date(self, date_value: Any) -> str:
        """날짜를 YYYY-MM-DD 형식으로 정규화"""
        if hasattr(date_value, 'strftime'):
            return date_value.strftime('%Y-%m-%d')
        elif isinstance(date_value, str):
            # 슬래시를 하이픈으로 변경
            return date_value.replace('/', '-')
        else:
            return str(date_value)
    
    def get_comparison_json(self) -> str:
        """원본 데이터와 가공된 데이터를 비교하는 JSON 생성"""
        processed_df = self.to_dataframe()
        
        # datetime 객체를 문자열로 변환
        raw_data_converted = self._convert_datetime_to_string(self.raw_data_list)
        processed_data_converted = self._convert_datetime_to_string(
            processed_df.to_dict(orient='records'))
        
        return json.dumps({
            "raw_crawled_data": raw_data_converted,
            "pandas_processed_data": processed_data_converted
        }, ensure_ascii=False, indent=4)
    
    def _convert_datetime_to_string(self, obj: Any) -> Any:
        """datetime 객체를 문자열로 변환하는 재귀 함수"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, dict):
            return {key: self._convert_datetime_to_string(value) 
                   for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_datetime_to_string(item) for item in obj]
        else:
            return obj


class KpiDataProcessor(BaseDataProcessor):
    """한국물가정보(KPI) 사이트 전용 데이터 처리기"""
    
    def transform_to_standard_format(self, raw_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """KPI 사이트의 원본 데이터를 표준 형식으로 변환"""
        transformed_items = []
        
        for spec_data in raw_data.get('spec_data', []):
            # spec_data가 직접 price 정보를 포함하는 경우
            has_direct_price = (
                'spec_name' in spec_data and 'region' in spec_data and
                'date' in spec_data and 'price' in spec_data)
            
            if has_direct_price:
                transformed_items.append({
                    'major_category': raw_data['major_category_name'],
                    'middle_category': raw_data['middle_category_name'],
                    'sub_category': raw_data['sub_category_name'],
                    'specification': spec_data['spec_name'],
                    'unit': '원/톤',  # KPI 기본값
                    'region': spec_data['region'],
                    'date': spec_data['date'],
                    'price': spec_data['price']
                })
            # 기존 구조 (prices 배열이 있는 경우)
            else:
                for price_info in spec_data.get('prices', []):
                    price_value = None
                    if price_info.get('price'):
                        try:
                            price_value = int(price_info['price'].replace(',', ''))
                        except (ValueError, AttributeError):
                            price_value = None
                    
                    transformed_items.append({
                        'major_category': raw_data['major_category_name'],
                        'middle_category': raw_data['middle_category_name'],
                        'sub_category': raw_data['sub_category_name'],
                        'specification': spec_data['specification_name'],
                        'unit': spec_data.get('unit', '원/톤'),
                        'region': price_info['region'],
                        'date': price_info['date'],
                        'price': price_value
                    })
        
        return transformed_items


class MaterialDataProcessor(BaseDataProcessor):
    """다른 자재 사이트용 데이터 처리기 (예시)"""
    
    def transform_to_standard_format(self, raw_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """다른 사이트의 원본 데이터를 표준 형식으로 변환
        
        이 메서드는 각 사이트의 데이터 구조에 맞게 구현해야 합니다.
        예시로 간단한 구조를 보여줍니다.
        """
        transformed_items = []
        
        # 예시: 다른 사이트의 데이터 구조
        # {
        #     'category': '철강',
        #     'product_name': 'H형강',
        #     'price_data': [
        #         {'location': '서울', 'date': '2024-01-01', 'cost': 50000},
        #         ...
        #     ]
        # }
        
        category = raw_data.get('category', '')
        product_name = raw_data.get('product_name', '')
        
        for price_item in raw_data.get('price_data', []):
            transformed_items.append({
                'major_category': category,
                'middle_category': '',  # 사이트에 따라 조정
                'sub_category': product_name,
                'specification': product_name,
                'unit': '원/톤',
                'region': price_item.get('location', ''),
                'date': price_item.get('date', ''),
                'price': price_item.get('cost')
            })
        
        return transformed_items


# 팩토리 함수
def create_data_processor(site_type: str) -> BaseDataProcessor:
    """사이트 타입에 따른 데이터 처리기 생성
    
    Args:
        site_type: 'kpi', 'material', 등
        
    Returns:
        해당 사이트용 데이터 처리기 인스턴스
    """
    processors = {
        'kpi': KpiDataProcessor,
        'material': MaterialDataProcessor,
        # 추후 다른 사이트 추가 가능
    }
    
    processor_class = processors.get(site_type)
    if not processor_class:
        raise ValueError(f"지원하지 않는 사이트 타입: {site_type}")
    
    return processor_class()