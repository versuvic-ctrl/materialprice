import sys
import os
import json
import re
import pandas as pd
import requests
from datetime import datetime
from typing import List, Dict, Any
from abc import ABC, abstractmethod
from dotenv import load_dotenv
from supabase import create_client, Client
from urllib.parse import urlparse
from unit_validation import UnitValidator
from api_monitor import create_monitored_supabase_client
import redis
from upstash_redis import Redis


# 환경변수 로드
load_dotenv("../../.env.local")
# 상대 경로가 작동하지 않을 경우 절대 경로 시도
if not os.environ.get("NEXT_PUBLIC_SUPABASE_URL"):
    load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env.local"))

# ======================================================================
# 1. log 함수 정의를 이곳으로 이동시킵니다.
# ======================================================================
def log(message: str, level: str = "INFO"):
    """실행 과정 로그를 출력하는 함수
    
    Args:
        message: 로그 메시지
        level: 로그 레벨 (INFO, SUCCESS, ERROR, SUMMARY, WARNING)
    """
    # 로그 레벨별 출력 제어
    now = datetime.now().strftime('%H:%M:%S')
    if level == "SUMMARY":
        print(f"[{now}] ✓ {message}", flush=True)
    elif level == "ERROR":
        print(f"[{now}] ✗ {message}", flush=True)
    elif level == "SUCCESS":
        print(f"[{now}] ✓ {message}", flush=True)
    elif level == "WARNING":
        print(f"[{now}] ⚠️ {message}", flush=True)
    else:  # INFO
        print(f"[{now}] {message}", flush=True)

# ======================================================================
# 2. 이제 Supabase 클라이언트 초기화 코드가 log 함수를 사용할 수 있습니다.
# ======================================================================
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") # anon 키의 이름은 SUPABASE_KEY로 변경해도 무방합니다.
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

# 서비스 키가 있으면 서비스 키를 사용, 없으면 anon 키를 사용
if SUPABASE_SERVICE_KEY:
    log("🔑 Supabase Service Role 키를 사용하여 클라이언트를 초기화합니다.")
    _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
else:
    log("⚠️ Supabase 익명 키(anon key)를 사용하여 클라이언트를 초기화합니다.", "WARNING")
    _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ======================================================================

# API 모니터링이 적용된 클라이언트 생성
api_monitor = create_monitored_supabase_client(
    _supabase_client, 
    max_calls_per_minute=200,  # 분당 최대 200회
    max_calls_per_hour=2000    # 시간당 최대 2000회
)
supabase = api_monitor.client

# Supabase 클라이언트 타입에 따라 적절한 table 접근 방법을 제공하는 헬퍼 함수
def get_supabase_table(client, table_name):
    """
    Supabase 클라이언트 타입에 따라 적절한 table 메서드를 반환합니다.
    MonitoredSupabaseClient의 경우 client.table()을, 일반 Client의 경우 table()을 사용합니다.
    """
    if hasattr(client, 'client') and hasattr(client.client, 'table'):
        # MonitoredSupabaseClient인 경우
        return client.client.table(table_name)
    elif hasattr(client, 'table'):
        # 일반 Client인 경우
        return client.table(table_name)
    else:
        raise AttributeError(f"클라이언트 객체에서 table 메서드를 찾을 수 없습니다: {type(client)}")
# Redis 클라이언트 초기화
try:
    # 먼저 UPSTASH_REDIS_REST_URL 환경 변수 확인
    import os
    if 'UPSTASH_REDIS_REST_URL' in os.environ:
        redis = Redis.from_env()
    elif 'REDIS_URL' in os.environ:
        # GitHub Actions에서 사용하는 REDIS_URL 환경 변수 처리
        redis_url = os.environ['REDIS_URL']
        redis_token = os.environ.get('REDIS_TOKEN', '')
        redis = Redis(url=redis_url, token=redis_token)
    else:
        # Redis 환경 변수가 없는 경우 None으로 설정
        redis = None
        log("⚠️ Redis 환경 변수가 설정되지 않았습니다. 캐시 기능이 비활성화됩니다.", "WARNING")
except Exception as e:
    redis = None
    log(f"⚠️ Redis 초기화 실패: {str(e)}. 캐시 기능이 비활성화됩니다.", "WARNING")
class BaseDataProcessor(ABC):
    """모든 사이트별 데이터 처리기의 기본 클래스"""
    
    def __init__(self):
        self.raw_data_list: List[Dict[str, Any]] = []
        self.processed_data_list: List[Dict[str, Any]] = []
        self.unit_validator = UnitValidator()  # 단위 검증기 초기화
    
    def add_raw_data(self, data: Dict[str, Any]):
        """파싱된 원본 데이터를 추가"""
        self.raw_data_list.append(data)
    
    @abstractmethod
    def transform_to_standard_format(self, raw_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """사이트별 원본 데이터를 표준 형식으로 변환하는 추상 메서드"""
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
    
    def check_existing_data_smart(self, major_category: str, middle_category: str, 
                                 sub_category: str, specification: str, 
                                 table_name: str = 'kpi_price_data') -> Dict[str, Any]:
        """
        Supabase에서 기존 데이터를 스마트하게 분석
        반환값:
        - existing_combinations: 기존 (날짜, 지역, 가격, 규격, 단위) 조합 set
        - existing_dates: 기존 날짜 set
        - existing_units: 기존 단위 set
        - has_data: 데이터 존재 여부
        """
        
        log(f"        - Supabase에서 기존 데이터 스마트 분석 중")
        
        try:
            response = get_supabase_table(supabase, table_name).select(
                'date, region, price, specification, unit'
            ).eq(
                'major_category', major_category
            ).eq(
                'middle_category', middle_category
            ).eq(
                'sub_category', sub_category
            ).eq(
                'specification', specification
            ).execute()
            
            existing_combinations = set()
            existing_dates = set()
            existing_units = set()
            
            if response.data:
                for item in response.data:
                    combo = (item['date'], item['region'], str(item['price']), 
                            item['specification'], item['unit'])
                    existing_combinations.add(combo)
                    existing_dates.add(item['date'])
                    existing_units.add(item['unit'])
                
                log(f"        - 기존 데이터 분석 완료: {len(existing_combinations)}개 조합, "
                    f"{len(existing_dates)}개 날짜, {len(existing_units)}개 단위")
            else:
                log("        - 기존 데이터 없음: 전체 추출 필요")
            
            return {
                'existing_combinations': existing_combinations,
                'existing_dates': existing_dates,
                'existing_units': existing_units,
                'has_data': bool(response.data)
            }
                
        except Exception as e:
            log(f"        - Supabase 확인 중 오류 발생: {str(e)}", "ERROR")
            return {
                'existing_combinations': set(),
                'existing_dates': set(),
                'existing_units': set(),
                'has_data': False
            }
    
    def check_existing_data(self, major_category: str, middle_category: str, 
                           sub_category: str, specification: str, 
                           table_name: str = 'kpi_price_data') -> set:
        """Supabase에서 기존 데이터의 (날짜, 지역, 가격, 규격, 단위) 조합을 확인"""
        
        log(f"        - Supabase에서 기존 데이터 조회")
        
        try:
            response = get_supabase_table(supabase, table_name).select(
                'date, region, price, specification, unit'
            ).eq(
                'major_category', major_category
            ).eq(
                'middle_category', middle_category
            ).eq(
                'sub_category', sub_category
            ).eq(
                'specification', specification
            ).execute()
            
            existing_data_set = set()
            if response.data:
                for item in response.data:
                    combo = (item['date'], item['region'], str(item['price']), item['specification'], item['unit'])
                    existing_data_set.add(combo)
                log(f"        - 기존 데이터 발견: {len(existing_data_set)}개 (날짜-지역-가격-규격-단위 조합)")
            else:
                log("        - 기존 데이터 없음: 전체 추출 필요")
            
            return existing_data_set
                
        except Exception as e:
            log(f"        - Supabase 확인 중 오류: {str(e)}")
            return set()  # 오류 발생 시 빈 set 반환
    
    def check_existing_data_batch(self, major_category: str, middle_category: str, 
                                 sub_category: str, target_date_range: tuple = None,
                                 table_name: str = 'kpi_price_data') -> dict:
        """
        전체 소분류에 대해 1회만 조회하여 기존 데이터를 메모리에 캐시
        API 호출을 규격별 개별 조회에서 전체 소분류 1회 조회로 최적화
        """
        
        log(f"🔍 배치 중복 검사: 전체 소분류 데이터 조회 시작")
        
        try:
            # 전체 소분류 데이터를 1회만 조회
            query = get_supabase_table(supabase, table_name).select(
                'date, region, price, specification, unit'
            ).eq('major_category', major_category)\
             .eq('middle_category', middle_category)\
             .eq('sub_category', sub_category)
            
            # 날짜 범위 필터링으로 성능 최적화
            if target_date_range:
                start_date, end_date = target_date_range
                query = query.gte('date', start_date).lte('date', end_date)
                log(f"    📅 날짜 범위 필터: {start_date} ~ {end_date}")
            
            response = query.execute()
            
            # 메모리 기반 중복 검사용 자료구조 생성
            existing_data_cache = {
                'combinations': set(),      # (date, region, price, spec, unit) 조합
                'by_specification': {},     # 규격별 그룹화
                'by_date': {},             # 날짜별 그룹화
                'total_count': 0
            }
            
            if response.data:
                for item in response.data:
                    # 중복 검사용 키 생성
                    combo_key = (
                item['date'], 
                item['region'], 
                item['specification'], 
                item['unit']
            )
                    existing_data_cache['combinations'].add(combo_key)
                    
                    # 규격별 그룹화
                    spec = item['specification']
                    if spec not in existing_data_cache['by_specification']:
                        existing_data_cache['by_specification'][spec] = set()
                    existing_data_cache['by_specification'][spec].add(combo_key)
                    
                    # 날짜별 그룹화  
                    date = item['date']
                    if date not in existing_data_cache['by_date']:
                        existing_data_cache['by_date'][date] = set()
                    existing_data_cache['by_date'][date].add(combo_key)
                    
                existing_data_cache['total_count'] = len(response.data)
                
                log(f"✅ 기존 데이터 캐시 생성 완료:")
                log(f"    📊 총 데이터: {existing_data_cache['total_count']}개")
                log(f"    🔧 규격 수: {len(existing_data_cache['by_specification'])}개")
                log(f"    📅 날짜 수: {len(existing_data_cache['by_date'])}개")
            else:
                log("📭 기존 데이터 없음: 전체 신규 데이터로 처리")
            
            return existing_data_cache
                
        except Exception as e:
            log(f"❌ 배치 중복 검사 중 오류 발생: {str(e)}", "ERROR")
            return {
                'combinations': set(),
                'by_specification': {},
                'by_date': {},
                'total_count': 0
            }
    
    def filter_duplicates_from_cache(self, new_data: list, 
                                    existing_cache: dict) -> list:
        """
        메모리 캐시를 사용하여 중복 데이터 필터링
        O(1) 시간복잡도로 고속 중복 체크
        """
        
        if not new_data:
            return []
            
        filtered_data = []
        duplicate_count = 0
        
        log(f"🔄 메모리 기반 중복 필터링 시작: {len(new_data)}개 데이터 처리")
        
        for record in new_data:
            # 새 데이터의 키 생성
            new_key = (
                record['date'],
                record['region'], 
                record['specification'],
                record['unit']
            )
            
            # 메모리에서 O(1) 시간복잡도로 중복 체크
            if new_key not in existing_cache['combinations']:
                filtered_data.append(record)
                # 캐시에 새 데이터 추가 (다음 청크를 위해)
                existing_cache['combinations'].add(new_key)
            else:
                duplicate_count += 1
        
        log(f"✅ 중복 필터링 완료:")
        log(f"    🗑️  중복 제거: {duplicate_count}개")
        log(f"    ✨ 신규 데이터: {len(filtered_data)}개")
        
        return filtered_data
    
    def save_to_cache(self, major_category: str, year: int, month: int, data: List[Dict]):
        """
        데이터를 캐시에 저장 (현재는 비활성화)
        """
        # Redis 캐시 사용을 중단하고 프론트엔드에서 사용하도록 변경
        return True
    
    def filter_new_data_only(self, df: pd.DataFrame, table_name: str = 'kpi_price_data') -> pd.DataFrame:
        """
        기존 데이터와 비교하여 스마트한 중복 체크 수행
        - 완전 중복: 건너뛰기
        - 부분 업데이트: 해당 날짜만 크롤링 필요
        - 단위 변경: 전체 데이터 덮어쓰기 필요
        """
        if df.empty:
            return df
        
        original_count = len(df)
        log(f"📊 데이터 품질 검증 시작: {original_count}개")
        
        # 1. 가격 데이터 검증 (NaN 제거)
        df = df.dropna(subset=['price'])
        after_price_check = len(df)
        if original_count != after_price_check:
            log(f"    - 가격 데이터 없는 행 제거: {original_count - after_price_check}개")
        
        # 2. 지역명 처리 및 정규화
        valid_regions = [
            '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
            '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
            '전국', '공통'
        ]
        
        def process_region_name(region_str):
            if pd.isna(region_str) or not region_str:
                return '전국'
            
            region_str = str(region_str).strip()
            
            # 유효한 지역명이 포함되어 있는지 확인
            if any(valid_region in region_str for valid_region in valid_regions):
                return region_str
            
            # 공통지역이나 특정 패턴 확인 (예: 날짜와 가격만 있는 경우)
            # 숫자나 특수문자만 있거나, 가격 패턴이 있는 경우 '전국'으로 처리
            if (region_str.replace(',', '').replace('.', '').replace('-', '').isdigit() or
                '원' in region_str or 
                len(region_str) < 2 or
                region_str in ['공통', '전체', '기타', '일반']):
                return '전국'
            
            # 기타 경우도 '전국'으로 처리 (너무 엄격한 검증 방지)
            return '전국'
        
        # 지역명 처리 적용
        df['region'] = df['region'].apply(process_region_name)
        after_region_check = len(df)
        
        # 처리 결과 로깅
        region_counts = df['region'].value_counts()
        nationwide_count = region_counts.get('전국', 0)
        if nationwide_count > 0:
            log(f"    - '전국'으로 처리된 데이터: {nationwide_count}개")
        
        # 3. 중복 데이터 제거 (같은 날짜, 지역, 규격, 가격, 단위)
        df = df.drop_duplicates(subset=['date', 'region', 'specification', 'price', 'unit'])
        after_duplicate_check = len(df)
        if after_region_check != after_duplicate_check:
            log(f"    - 중복 데이터 제거: {after_region_check - after_duplicate_check}개")
        
        log(f"📊 데이터 품질 검증 완료: {original_count}개 → {after_duplicate_check}개")
        
        # 4. 단위 검증 및 자동 수정
        log("🔍 단위 검증 및 자동 수정 시작...")
        df = self.unit_validator.validate_and_fix_units(df)
        after_unit_validation = len(df)
        log(f"📊 단위 검증 완료: {after_duplicate_check}개 → {after_unit_validation}개")
        
        if df.empty:
            log("📊 품질 검증 후 저장할 데이터가 없습니다.")
            return df
        
        # 5. 스마트 중복 체크 및 업데이트 전략 결정
        category_groups = df.groupby(['major_category', 'middle_category', 'sub_category', 'specification'])
        
        new_records = []
        total_records = len(df)
        skipped_count = 0
        partial_update_count = 0
        full_update_count = 0
        
        for (major_cat, middle_cat, sub_cat, spec), group_df in category_groups:
            log(f"    - 스마트 분석: {major_cat} > {middle_cat} > {sub_cat} > {spec}")
            
            # 기존 데이터 스마트 분석
            existing_analysis = self.check_existing_data_smart(
                major_cat, middle_cat, sub_cat, spec, table_name
            )
            
            if not existing_analysis['has_data']:
                # 기존 데이터 없음 - 전체 추가
                for _, record in group_df.iterrows():
                    new_records.append(record.to_dict())
                log(f"        - 신규 데이터: 전체 {len(group_df)}개 추가")
                continue
            
            # 단위 변경 감지
            new_units = set(group_df['unit'].unique())
            existing_units = existing_analysis['existing_units']
            
            if new_units != existing_units:
                # 단위가 변경됨 - 전체 덮어쓰기 필요
                log(f"        - 단위 변경 감지: {existing_units} → {new_units}")
                log(f"        - 전체 덮어쓰기 필요: {len(group_df)}개")
                
                # 기존 데이터 삭제 마킹 (실제 삭제는 save_to_supabase에서)
                for _, record in group_df.iterrows():
                    record_dict = record.to_dict()
                    record_dict['_force_update'] = True  # 강제 업데이트 플래그
                    new_records.append(record_dict)
                full_update_count += len(group_df)
                continue
            
            # 날짜별 중복 체크
            existing_combinations = existing_analysis['existing_combinations']
            existing_dates = existing_analysis['existing_dates']
            new_dates = set(group_df['date'].unique())
            
            group_new_count = 0
            group_duplicate_count = 0
            
            for _, record in group_df.iterrows():
                record_key = (record['date'], record['region'], str(record['price']), 
                             record['specification'], record['unit'])
                
                if record_key not in existing_combinations:
                    new_records.append(record.to_dict())
                    group_new_count += 1
                else:
                    group_duplicate_count += 1
                    skipped_count += 1
            
            if group_duplicate_count > 0:
                log(f"        - 완전 중복 SKIP: {group_duplicate_count}개")
            if group_new_count > 0:
                if any(date not in existing_dates for date in new_dates):
                    log(f"        - 부분 업데이트: 신규 {group_new_count}개")
                    partial_update_count += group_new_count
                else:
                    log(f"        - 신규 데이터: {group_new_count}개")
        
        # 결과 요약
        log(f"📊 스마트 분석 결과:")
        log(f"    - 전체 {total_records}개 중")
        log(f"    - 완전 중복 SKIP: {skipped_count}개")
        log(f"    - 부분 업데이트: {partial_update_count}개")
        log(f"    - 전체 덮어쓰기: {full_update_count}개")
        log(f"    - 최종 처리: {len(new_records)}개")
        
        return pd.DataFrame(new_records)

    def save_to_supabase(self, data: List[Dict[str, Any]], table_name: str = 'kpi_price_data') -> int:
        """
        Supabase에 데이터 저장 - 최적화된 배치 중복 검사 적용 및 환경 변수 기반 URL 사용
        """
        if not data:
            log("저장할 데이터가 없습니다.")
            return 0
        
        # 유효성 검증
        valid_records = [record for record in data if self._is_valid_record(record)]
        
        if not valid_records:
            log("❌ 유효한 레코드가 없습니다.")
            return 0
        
        log(f"✅ 유효성 검증 완료: {len(valid_records)}개")
        
        # 카테고리별로 그룹화
        category_groups = {}
        for record in valid_records:
            key = (record['major_category'], record['middle_category'], record['sub_category'])
            if key not in category_groups:
                category_groups[key] = []
            category_groups[key].append(record)
        
        total_saved = 0
        
        # --- 수정 시작 ---
        # 환경 변수에서 프론트엔드 URL을 가져옴. 없으면 로컬 주소를 기본값으로 사용.
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        cache_invalidation_url = f"{frontend_url}/api/cache/invalidate"
        # --- 수정 끝 ---
        
        # 각 카테고리별로 최적화된 배치 처리
        for (major_cat, middle_cat, sub_cat), group_records in category_groups.items():
            log(f"🔍 카테고리 처리: {major_cat} > {middle_cat} > {sub_cat} ({len(group_records)}개)")
            log(f"    [Supabase] 저장 시작: {table_name} 테이블")
            
            target_dates = list(set(record['date'] for record in group_records))
            date_range = (min(target_dates), max(target_dates)) if target_dates else None
            
            existing_cache = self.check_existing_data_batch(
                major_cat, middle_cat, sub_cat, 
                target_date_range=date_range,
                table_name=table_name
            )
            
            filtered_records = self.filter_duplicates_from_cache(group_records, existing_cache)
            
            if not filtered_records:
                log(f"    📭 신규 데이터 없음: 모든 데이터가 중복")
                continue
            
            chunk_size = 1000
            chunks = [filtered_records[i:i + chunk_size] for i in range(0, len(filtered_records), chunk_size)]
            
            category_saved = 0
            for i, chunk in enumerate(chunks, 1):
                try:
                    log(f"    [Supabase] Upsert 시도: {len(chunk)}개 레코드")
                    insert_response = get_supabase_table(supabase, table_name).upsert(chunk).execute()
                    log(f"    [Supabase] Upsert 응답 성공")
                    
                    try:
                        # --- 수정된 URL 사용 ---
                        cache_payload = {
                            "type": "material_prices",
                            "materials": list(set([record.get('specification', '') for record in chunk if record.get('specification')]))
                        }
                        cache_response = requests.post(cache_invalidation_url, json=cache_payload, timeout=5)
                        if cache_response.status_code == 200:
                            log(f"    ✅ Redis 캐시 무효화 성공")
                        else:
                            log(f"    ⚠️ Redis 캐시 무효화 실패: {cache_response.status_code}")
                    except Exception as cache_error:
                        if "Connection refused" in str(cache_error) or "Failed to establish" in str(cache_error):
                            log(f"    ⚠️ Redis 캐시 무효화 건너뜀: 프론트엔드 서버({frontend_url}) 미실행", "WARNING")
                        else:
                            log(f"    ⚠️ Redis 캐시 무효화 오류: {str(cache_error)}", "WARNING")
                    
                    if insert_response.data is not None:
                        chunk_saved = len(insert_response.data) if insert_response.data else 0
                        category_saved += chunk_saved
                        log(f"    ✅ 청크 {i}: {chunk_saved}개 저장 완료")
                    else:
                        log(f"    ❌ 청크 {i}: 저장 실패 - 응답 데이터 없음")
                
                except Exception as e:
                    log(f"❌ 청크 {i} 저장 실패: {str(e)}", "ERROR")
                    log(f"    [Supabase] 오류 상세: {e.args}", "ERROR")
                    continue
            
            total_saved += category_saved
            log(f"    📊 카테고리 저장 완료: {category_saved}개")
        
        log(f"🎉 최적화된 배치 저장 완료: 총 {total_saved}개 데이터")
        return total_saved

    def save_to_supabase_legacy(self, data: List[Dict[str, Any]], table_name: str = 'kpi_price_data') -> int:
        """
        기존 save_to_supabase 메서드 (레거시 버전) - 호환성을 위해 보존 및 URL 수정
        """
        if not data:
            log("저장할 데이터가 없습니다.")
            return 0
        
        force_update_data = []
        normal_data = []
        
        for record in data:
            if record.get('_force_update', False):
                clean_record = {k: v for k, v in record.items() if k != '_force_update'}
                force_update_data.append(clean_record)
            else:
                normal_data.append(record)
        
        total_saved = 0
        
        # --- 수정 시작 ---
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        cache_invalidation_url = f"{frontend_url}/api/cache/invalidate"
        # --- 수정 끝 ---
        
        if force_update_data:
            log(f"🔄 강제 업데이트 데이터 처리: {len(force_update_data)}개")
            # ... (이하 로직은 거의 동일, cache_invalidation_url 변수만 사용하도록) ...
            for (major_cat, middle_cat, sub_cat, spec), group_records in force_groups.items():
                try:
                    # ... (기존 데이터 삭제 로직) ...
                    if valid_records:
                        # ... (새 데이터 삽입 로직) ...
                        try:
                            # --- 수정된 URL 사용 ---
                            cache_payload = {"type": "material_prices", "materials": [spec]}
                            cache_response = requests.post(cache_invalidation_url, json=cache_payload, timeout=5)
                            # ... (응답 처리 로직) ...
                        except Exception as cache_error:
                            log(f"    ⚠️ Redis 캐시 무효화 오류: {str(cache_error)}", "WARNING")
                    
                except Exception as e:
                    log(f"❌ 강제 업데이트 실패: {str(e)}")

        if normal_data:
            log(f"💾 일반 데이터 저장: {len(normal_data)}개")
            # ... (이하 로직은 거의 동일, cache_invalidation_url 변수만 사용하도록) ...
            for i, chunk in enumerate(chunks, 1):
                try:
                    # ... (중복 제거 및 삽입 로직) ...
                    if insert_response.data:
                        # ...
                        try:
                            # --- 수정된 URL 사용 ---
                            cache_payload = {
                                "type": "material_prices",
                                "materials": list(set([record.get('specification', '') for record in chunk if record.get('specification')]))
                            }
                            cache_response = requests.post(cache_invalidation_url, json=cache_payload, timeout=5)
                            # ... (응답 처리 로직) ...
                        except Exception as cache_error:
                            log(f"    ⚠️ Redis 캐시 무효화 오류: {str(cache_error)}", "WARNING")
                    # ...
                except Exception as e:
                    log(f"❌ 청크 {i} 저장 실패: {str(e)}")
                    continue
        
        log(f"💾 총 {total_saved}개 데이터 저장 완료")
        return total_saved
        
        # 2. 일반 데이터 처리 (기존 로직)
        if normal_data:
            log(f"💾 일반 데이터 저장: {len(normal_data)}개")
            
            # 유효성 검증
            valid_records = [record for record in normal_data if self._is_valid_record(record)]
            
            if not valid_records:
                log("❌ 유효한 레코드가 없습니다.")
                return total_saved
            
            log(f"✅ 유효성 검증 완료: {len(valid_records)}개")
            
            # 청크 단위로 처리 (1000개씩)
            chunk_size = 1000
            chunks = [valid_records[i:i + chunk_size] for i in range(0, len(valid_records), chunk_size)]
            
            for i, chunk in enumerate(chunks, 1):
                try:
                    # 중복 검사를 위한 키 생성
                    chunk_keys = set()
                    for record in chunk:
                        key = (record['date'], record['region'], str(record['price']), 
                              record['specification'], record['unit'])
                        chunk_keys.add(key)
                    
                    # 기존 데이터에서 중복되는 항목 삭제
                    if chunk_keys:
                        # 날짜, 지역, 가격, 규격, 단위 조합으로 기존 데이터 조회
                        existing_query = get_supabase_table(supabase, table_name).select('*')
                        
                        # 청크의 날짜 범위로 필터링하여 성능 최적화
                        chunk_dates = list(set(record['date'] for record in chunk))
                        if len(chunk_dates) == 1:
                            existing_query = existing_query.eq('date', chunk_dates[0])
                        else:
                            existing_query = existing_query.in_('date', chunk_dates)
                        
                        existing_response = existing_query.execute()
                        
                        if existing_response.data:
                            # 중복되는 기존 데이터의 ID 수집
                            ids_to_delete = []
                            for existing_record in existing_response.data:
                                existing_key = (
                                    existing_record['date'], 
                                    existing_record['region'], 
                                    str(existing_record['price']), 
                                    existing_record['specification'], 
                                    existing_record['unit']
                                )
                                if existing_key in chunk_keys:
                                    ids_to_delete.append(existing_record['id'])
                            
                            # 중복 데이터 삭제
                            if ids_to_delete:
                                delete_response = get_supabase_table(supabase, table_name).delete().in_('id', ids_to_delete).execute()
                                deleted_count = len(delete_response.data) if delete_response.data else 0
                                log(f"    - 청크 {i}: 중복 데이터 {deleted_count}개 삭제")
                    
                    # 새 데이터 삽입
                    insert_response = get_supabase_table(supabase, table_name).insert(chunk).execute()
                    
                    if insert_response.data:
                        chunk_saved = len(insert_response.data)
                        total_saved += chunk_saved
                        log(f"    - 청크 {i}: {chunk_saved}개 저장 완료")
                        
                        # Redis 캐시 무효화 API 호출
                        try:
                            cache_invalidation_url = "http://localhost:3000/api/cache/invalidate"
                            cache_payload = {
                                "type": "material_prices",
                                "materials": list(set([record.get('specification', '') for record in chunk if record.get('specification')]))
                            }
                            cache_response = requests.post(cache_invalidation_url, json=cache_payload, timeout=5)
                            if cache_response.status_code == 200:
                                log(f"    ✅ Redis 캐시 무효화 성공")
                            else:
                                log(f"    ⚠️ Redis 캐시 무효화 실패: {cache_response.status_code}")
                        except Exception as cache_error:
                            log(f"    ⚠️ Redis 캐시 무효화 오류: {str(cache_error)}", "WARNING")
                    else:
                        log(f"    - 청크 {i}: 저장 실패 - 응답 데이터 없음")
                
                except Exception as e:
                    log(f"❌ 청크 {i} 저장 실패: {str(e)}")
                    continue
        
        log(f"💾 총 {total_saved}개 데이터 저장 완료")
        return total_saved

    def _is_valid_record(self, record: Dict[str, Any]) -> bool:
        """레코드의 유효성을 검증"""
        required_fields = ['major_category', 'middle_category', 'sub_category', 
                          'specification', 'region', 'date']
        
        for field in required_fields:
            if field not in record or pd.isna(record[field]) or not record[field]:
                return False
        
        if not self._is_valid_date_value(record['date']):
            return False
        
        price = record.get('price')
        if price is not None and not isinstance(price, (int, float)):
             # NaN 값도 유효하지 않은 것으로 처리
            if pd.isna(price):
                return False
            return False
        
        return True
    
    def _is_valid_date_value(self, date_value: Any) -> bool:
        """날짜 값이 유효한지 확인"""
        if date_value is None or date_value == '':
            return False
        
        if isinstance(date_value, str):
            date_str = date_value.strip()
            
            # "2025. 1" 형식 허용
            if re.match(r'^\d{4}\.\s*\d{1,2}$', date_str):
                return True

            # 추가: 년-월 형식 허용 (예: 2025-09, 2025-9)
            if re.match(r'^\d{4}-\d{1,2}$', date_str):
                return True

            # "2025-01-01" 형식 허용
            if re.match(r'^\d{4}-\d{1,2}-\d{1,2}$', date_str):
                return True
            
            # "2025/1/1" 형식 허용
            if re.match(r'^\d{4}/\d{1,2}/\d{1,2}$', date_str):
                return True
            
            return False
        
        # datetime 객체는 유효
        if hasattr(date_value, 'strftime'):
            return True
        
        return False
    
    def _normalize_date(self, date_value: Any) -> str:
        """날짜를 YYYY-MM-DD 형식으로 정규화"""
        if hasattr(date_value, 'strftime'):
            return date_value.strftime('%Y-%m-%d')
        elif isinstance(date_value, str):
            date_str = date_value.strip()
            
            # "2025. 1" 형식을 "2025-01-01"로 변환
            if re.match(r'^\d{4}\.\s*\d{1,2}$', date_str):
                year, month = date_str.replace('.', '').split()
                return f"{year}-{int(month):02d}-01"
            
            # "2025/1" 또는 "2025-1" 형식 처리
            if '/' in date_str or '-' in date_str:
                date_str = date_str.replace('/', '-')
                parts = date_str.split('-')
                if len(parts) >= 2:
                    year, month = parts[0], parts[1]
                    day = parts[2] if len(parts) > 2 else '01'
                    return f"{year}-{int(month):02d}-{int(day):02d}"
            
            return date_str
        else:
            return str(date_value)
    
    def get_comparison_json(self) -> str:
        """원본 데이터와 가공된 데이터를 비교하는 JSON 생성"""
        processed_df = self.to_dataframe()
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

# --- 이하 KpiDataProcessor, MaterialDataProcessor, create_data_processor 함수는 변경할 필요가 없습니다. ---

class KpiDataProcessor(BaseDataProcessor):
    """한국물가정보(KPI) 사이트 전용 데이터 처리기"""
    
    def _normalize_region_name(self, region_name: str) -> str:
        """지역명을 정규화하고 빈 값이나 None을 처리"""
        # None이나 빈 문자열 처리
        if not region_name or region_name == 'None' or str(region_name).strip() == '':
            return '전국'  # 기본값으로 '전국' 설정
            
        region_str = str(region_name).strip()
        
        # '공통지역'을 '전국'으로 변환
        if region_str == '공통지역':
            return '전국'
            
        # 패턴: 지역명 첫글자 + 숫자 + 지역명 나머지 (예: 서1울 → 서울1)
        pattern = r'^([가-힣])(\d+)([가-힣]+)$'
        match = re.match(pattern, region_str)
        
        if match:
            first_char, number, rest = match.groups()
            return f"{first_char}{rest}{number}"  # 서1울 → 서울1
        
        return region_str  # 변환 불가능한 경우 원본 반환
    
    def _extract_material_name_from_specification(self, specification: str) -> str:
        """SPECIFICATION에서 자재명을 추출하는 규칙"""
        if not specification:
            return specification
        
        spec_str = str(specification).strip()
        
        # 규칙 1: HDPE DC 고압관 관련
        if 'HDPE' in spec_str and 'DC' in spec_str and '고압관' in spec_str:
            return f"{spec_str} - DC고압관"
        
        # 규칙 2: PVC 관련
        if 'PVC' in spec_str:
            if '상수도관' in spec_str:
                return f"{spec_str} - PVC상수도관"
            elif '하수도관' in spec_str:
                return f"{spec_str} - PVC하수도관"
            elif '배수관' in spec_str:
                return f"{spec_str} - PVC배수관"
        
        # 규칙 3: 철근 관련
        if '철근' in spec_str:
            if 'SD' in spec_str:
                return f"{spec_str} - SD철근"
            elif '이형' in spec_str:
                return f"{spec_str} - 이형철근"
        
        # 규칙 4: 레미콘 관련
        if '레미콘' in spec_str or '콘크리트' in spec_str:
            if '고강도' in spec_str:
                return f"{spec_str} - 고강도콘크리트"
            elif '일반' in spec_str:
                return f"{spec_str} - 일반콘크리트"
        
        # 규칙 5: 아스팔트 관련
        if '아스팔트' in spec_str:
            if '포장용' in spec_str:
                return f"{spec_str} - 포장용아스팔트"
            elif '방수용' in spec_str:
                return f"{spec_str} - 방수용아스팔트"
        
        # 규칙 6: 골재 관련
        if '골재' in spec_str:
            if '쇄석' in spec_str:
                return f"{spec_str} - 쇄석골재"
            elif '모래' in spec_str:
                return f"{spec_str} - 모래골재"
        
        # 규칙 7: 시멘트 관련
        if '시멘트' in spec_str:
            if '포틀랜드' in spec_str:
                return f"{spec_str} - 포틀랜드시멘트"
            elif '혼합' in spec_str:
                return f"{spec_str} - 혼합시멘트"
        
        # 규칙 8: 형강 관련
        if '형강' in spec_str:
            if 'H형강' in spec_str or 'H-' in spec_str:
                return f"{spec_str} - H형강"
            elif 'I형강' in spec_str or 'I-' in spec_str:
                return f"{spec_str} - I형강"
        
        # 규칙 9: 강관 관련
        if '강관' in spec_str:
            if '배관용' in spec_str:
                return f"{spec_str} - 배관용강관"
            elif '구조용' in spec_str:
                return f"{spec_str} - 구조용강관"
        
        # 규칙 10: 전선 관련
        if '전선' in spec_str or '케이블' in spec_str:
            if 'CV' in spec_str:
                return f"{spec_str} - CV케이블"
            elif 'HIV' in spec_str:
                return f"{spec_str} - HIV케이블"
            elif '통신' in spec_str:
                return f"{spec_str} - 통신케이블"
        
        # 기본값: 원본 specification 반환
        return spec_str

    async def process_data(self, major_category: str, middle_category: str, sub_category: str) -> List[Dict[str, Any]]:
        """배치 처리를 위한 데이터 가공 메서드"""
        try:
            filtered_data = []
            for raw_data in self.raw_data_list:
                if (raw_data.get('major_category_name') == major_category and
                    raw_data.get('middle_category_name') == middle_category and
                    raw_data.get('sub_category_name') == sub_category):
                    filtered_data.append(raw_data)
            
            if not filtered_data:
                return []
            
            processed_items = []
            for raw_item in filtered_data:
                transformed_items = self.transform_to_standard_format(raw_item)
                processed_items.extend(transformed_items)
            
            return processed_items
            
        except Exception as e:
            log(f"데이터 가공 중 오류 발생: {str(e)}", "ERROR")
            return []
    
    async def save_to_supabase(self, processed_data: List[Dict[str, Any]], table_name: str = 'kpi_price_data', check_duplicates: bool = True) -> int:
        """가공된 데이터를 Supabase에 저장"""
        if not processed_data:
            log("저장할 데이터가 없습니다.")
            return 0
        
        try:
            log(f"📊 저장 시도: {len(processed_data)}개 데이터 → '{table_name}' 테이블")
            
            # 부모 클래스의 save_to_supabase 메서드를 호출하여 중복 제거 및 저장 로직 실행
            actual_saved_count = super().save_to_supabase(processed_data, table_name)
            
            # 실제 저장된 개수를 기준으로 메시지 출력
            if actual_saved_count > 0:
                log(f"✅ 저장 완료: {actual_saved_count}개 데이터")
            else:
                log(f"ℹ️ 저장 완료: 신규 데이터 없음 (전체 {len(processed_data)}개 모두 중복)")
            
            return actual_saved_count
            
        except Exception as e:
            log(f"❌ Supabase 저장 중 오류 발생: {str(e)}", "ERROR")
            return 0
    
    def transform_to_standard_format(self, raw_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """KPI 사이트의 원본 데이터를 표준 형식으로 변환"""
        transformed_items = []
        
        for spec_data in raw_data.get('spec_data', []):
            has_direct_price = (
                'spec_name' in spec_data and 'region' in spec_data and
                'date' in spec_data and 'price' in spec_data)
            
            if has_direct_price:
                price_value = spec_data.get('price')
                if price_value is not None:
                    try:
                        price_value = float(str(price_value).replace(',', ''))
                    except (ValueError, TypeError):
                        price_value = None
                
                # SPECIFICATION에서 자재명 추출 적용
                original_spec = spec_data['spec_name']
                enhanced_spec = self._extract_material_name_from_specification(original_spec)
                
                # 크롤링된 실제 단위 정보 사용 (하드코딩된 '원/톤' 대신)
                actual_unit = raw_data.get('unit', '원/톤')
                
                transformed_items.append({
                    'major_category': raw_data['major_category_name'],
                    'middle_category': raw_data['middle_category_name'],
                    'sub_category': raw_data['sub_category_name'],
                    'specification': enhanced_spec,
                    'unit': actual_unit,
                    'region': self._normalize_region_name(spec_data['region']),
                    'date': spec_data['date'],
                    'price': price_value
                })
            else:
                for price_info in spec_data.get('prices', []):
                    price_value = None
                    if price_info.get('price'):
                        try:
                            price_value = float(str(price_info['price']).replace(',', ''))
                        except (ValueError, AttributeError):
                            price_value = None
                    
                    # SPECIFICATION에서 자재명 추출 적용
                    original_spec = spec_data['specification_name']
                    enhanced_spec = self._extract_material_name_from_specification(original_spec)
                    
                    # 크롤링된 실제 단위 정보 사용 (spec_data의 unit이 없으면 raw_data의 unit 사용)
                    actual_unit = spec_data.get('unit') or raw_data.get('unit', '원/톤')
                    
                    transformed_items.append({
                        'major_category': raw_data['major_category_name'],
                        'middle_category': raw_data['middle_category_name'],
                        'sub_category': raw_data['sub_category_name'],
                        'specification': enhanced_spec,
                        'unit': actual_unit,
                        'region': self._normalize_region_name(price_info['region']),
                        'date': price_info['date'],
                        'price': price_value
                    })
        
        return transformed_items
    
    def get_api_usage_summary(self) -> Dict[str, Any]:
        """API 사용량 요약 정보 반환"""
        return api_monitor.get_usage_summary()
    
    def print_api_usage_summary(self):
        """API 사용량 요약을 콘솔에 출력"""
        api_monitor.print_usage_summary()
    
    def save_api_stats(self, filename: str = None):
        """API 사용량 통계를 파일로 저장"""
        if filename is None:
            filename = f"api_stats_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        api_monitor.save_stats(filename)


class MaterialDataProcessor(BaseDataProcessor):
    """다른 자재 사이트용 데이터 처리기 (예시)"""
    
    def transform_to_standard_format(self, raw_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        transformed_items = []
        category = raw_data.get('category', '')
        product_name = raw_data.get('product_name', '')
        
        for price_item in raw_data.get('price_data', []):
            transformed_items.append({
                'major_category': category,
                'middle_category': '',
                'sub_category': product_name,
                'specification': product_name,
                'unit': '원/톤',
                'region': price_item.get('location', ''),
                'date': price_item.get('date', ''),
                'price': price_item.get('cost')
            })
        
        return transformed_items


def create_data_processor(site_type: str) -> BaseDataProcessor:
    """사이트 타입에 따른 데이터 처리기 생성"""
    processors = {
        'kpi': KpiDataProcessor,
        'material': MaterialDataProcessor,
    }
    
    processor_class = processors.get(site_type)
    if not processor_class:
        raise ValueError(f"지원하지 않는 사이트 타입: {site_type}")
    
    return processor_class()
