import os
import json
import re
import pandas as pd
import requests
from datetime import datetime
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from supabase import create_client, Client
from urllib.parse import urlparse

# 환경변수 로드
load_dotenv("../../.env.local")
# 상대 경로가 작동하지 않을 경우 절대 경로 시도
if not os.environ.get("NEXT_PUBLIC_SUPABASE_URL"):
    load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env.local"))

# Supabase 클라이언트 초기화
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Redis REST API 클라이언트 초기화
redis_client = None
redis_connection_failed = False
redis_rest_url = None
redis_rest_token = None

try:
    # REST API 환경변수 우선 확인
    redis_rest_url = os.environ.get("UPSTASH_REDIS_REST_URL")
    redis_rest_token = os.environ.get("UPSTASH_REDIS_REST_TOKEN")
    
    if redis_rest_url and redis_rest_token:
        # HTTP 기반 Redis 연결 테스트
        response = requests.get(
            f"{redis_rest_url}/ping",
            headers={"Authorization": f"Bearer {redis_rest_token}"},
            timeout=10
        )
        if response.status_code == 200:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ✓ Redis REST API 연결 성공")
        else:
            raise Exception(f"REST API 연결 실패: {response.status_code}")
    else:
        # 기존 Redis URL에서 REST API 정보 추출 시도
        REDIS_URL = os.environ.get("REDIS_URL")
        if REDIS_URL:
            parsed = urlparse(REDIS_URL)
            redis_rest_url = f"https://{parsed.hostname}"
            redis_rest_token = parsed.password
            
            # 연결 테스트
            response = requests.get(
                f"{redis_rest_url}/ping",
                headers={"Authorization": f"Bearer {redis_rest_token}"},
                timeout=10
            )
            if response.status_code == 200:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] ✓ Redis REST API 연결 성공 (URL에서 추출)")
            else:
                raise Exception(f"REST API 연결 실패: {response.status_code}")
        else:
            raise Exception("Redis 환경변수가 설정되지 않았습니다.")
            
except Exception as e:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✗ Redis 연결 실패: {e}")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] ℹ Redis 캐싱 비활성화 - Supabase 직접 조회로 진행")
    redis_client = None
    redis_connection_failed = True
    redis_rest_url = None
    redis_rest_token = None


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
    
    def check_existing_data(self, major_category: str, middle_category: str, 
                           sub_category: str, specification: str, 
                           table_name: str = 'kpi_price_data') -> set:
        """Supabase 또는 Redis 캐시에서 기존 데이터의 (날짜, 지역, 가격, 규격) 조합을 확인"""
        
        # global 변수 선언
        global redis_connection_failed, redis_rest_url, redis_rest_token
        
        # 1. 캐시 키(key) 생성: 각 품목별로 고유한 키를 만듦
        cache_key = f"existing_data:{table_name}:{major_category}:{middle_category}:{sub_category}:{specification}"

        # 2. Redis 캐시 먼저 확인 (Cache HIT) - 연결 상태 확인 포함
        if not redis_connection_failed and redis_rest_url and redis_rest_token:
            try:
                # HTTP 기반 Redis GET 요청
                response = requests.get(
                    f"{redis_rest_url}/get/{cache_key}",
                    headers={"Authorization": f"Bearer {redis_rest_token}"},
                    timeout=10
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get("result"):
                        log(f"        - [Cache HIT] Redis에서 기존 데이터 로드")
                        # Redis는 문자열로 저장되므로, 원래의 set 형태로 변환
                        loaded_list = json.loads(result["result"])
                        return {tuple(item) for item in loaded_list}
                elif response.status_code == 404:
                    # 캐시에 데이터가 없음 (정상)
                    pass
                else:
                    raise Exception(f"Redis GET 실패: {response.status_code}")
            except Exception as e:
                log(f"        - Redis 조회 중 오류: {e}", "ERROR")
                redis_connection_failed = True

        # 3. 캐시가 없으면(Cache MISS) Supabase에서 데이터 조회 (기존 로직)
        if redis_connection_failed:
            log(f"        - [Redis 비활성화] Supabase에서 기존 데이터 조회")
        else:
            log(f"        - [Cache MISS] Supabase에서 기존 데이터 조회")
        
        try:
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
            
            existing_data_set = set()
            if response.data:
                for item in response.data:
                    combo = (item['date'], item['region'], str(item['price']), item['specification'])
                    existing_data_set.add(combo)
                log(f"        - 기존 데이터 발견: {len(existing_data_set)}개")
            else:
                log("        - 기존 데이터 없음: 전체 추출 필요")
            
            # 4. 조회한 결과를 Redis에 저장 (24시간 동안 유효) - Redis 연결 상태 확인
            if not redis_connection_failed and redis_rest_url and redis_rest_token:
                try:
                    # Python의 set은 JSON으로 바로 변환 불가하므로 list로 변경
                    data_to_cache = [list(item) for item in existing_data_set]
                    # HTTP 기반 Redis SET 요청 (TTL 24시간)
                    response = requests.post(
                        f"{redis_rest_url}/set/{cache_key}",
                        headers={"Authorization": f"Bearer {redis_rest_token}"},
                        json={"value": json.dumps(data_to_cache), "ex": 86400},
                        timeout=10
                    )
                    
                    if response.status_code == 200:
                        log(f"        - 조회된 데이터를 Redis에 24시간 동안 캐싱 완료")
                    else:
                        log(f"        - Redis 캐싱 실패: {response.status_code}", "WARNING")
                except Exception as e:
                    log(f"        - Redis 캐싱 중 오류 (무시하고 계속 진행): {e}", "WARNING")
            
            return existing_data_set
                
        except Exception as e:
            log(f"        - Supabase 확인 중 오류: {str(e)}")
            return set()  # 오류 발생 시 빈 set 반환
    
    def save_to_cache(self, major_category: str, year: int, month: int, data: List[Dict]):
        """
        크롤링한 데이터를 Redis 캐시에 저장 (24시간 TTL)
        """
        global redis_connection_failed, redis_rest_url, redis_rest_token
        
        if redis_connection_failed or not redis_rest_url or not redis_rest_token:
            return
        
        cache_key = f"kpi_data:{major_category}:{year}:{month:02d}"
        
        try:
            # HTTP 기반 Redis SET 요청 (TTL 24시간)
            response = requests.post(
                f"{redis_rest_url}/set/{cache_key}",
                headers={"Authorization": f"Bearer {redis_rest_token}"},
                json={"value": json.dumps(data), "ex": 86400},
                timeout=10
            )
            
            if response.status_code == 200:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] ✓ 크롤링 데이터 Redis 캐싱 완료 ({len(data)}개 항목)")
            else:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠ Redis 캐싱 실패: {response.status_code}")
                
        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠ Redis 캐싱 중 오류: {e}")
    
    def filter_new_data_only(self, df: pd.DataFrame, table_name: str = 'kpi_price_data') -> pd.DataFrame:
        """기존 데이터와 비교하여 새로운 데이터만 필터링 (날짜-지역-가격-규격 조합 기준)"""
        if df.empty:
            return df
        
        # pandas를 활용한 데이터 품질 검증 및 정제
        log("📊 pandas를 활용한 데이터 품질 검증 시작...")
        
        # 1. 필수 필드 null 값 제거
        original_count = len(df)
        df = df.dropna(subset=['region', 'price', 'date', 'specification'])
        after_null_check = len(df)
        if original_count != after_null_check:
            log(f"    - 필수 필드 null 제거: {original_count - after_null_check}개")
        
        # 2. 유효하지 않은 가격 제거 (0 이하 또는 비정상적으로 큰 값)
        df = df[(df['price'] > 0) & (df['price'] < 999999999)]
        after_price_check = len(df)
        if after_null_check != after_price_check:
            log(f"    - 유효하지 않은 가격 제거: {after_null_check - after_price_check}개")
        
        # 3. 지역명 표준화 및 검증
        valid_regions = ['강원', '경기', '경남', '경북', '광주', '대구', '대전', 
                        '부산', '서울', '세종', '울산', '인천', '전남', '전북', 
                        '제주', '충남', '충북', '수원', '성남', '춘천']
        
        # 지역명 처리 및 검증
        def process_region_name(region_name):
            if not region_name or pd.isna(region_name):
                return '전국'  # 지역 정보가 없으면 '전국'으로 처리
            
            region_str = str(region_name).strip()
            
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
        
        # 이제 모든 데이터가 유효한 지역명을 가지므로 제거되는 데이터는 없음
        if after_price_check != after_region_check:
            log(f"    - 지역명 처리 완료: {after_price_check}개 → {after_region_check}개")
        
        # 4. 중복 데이터 제거 (같은 날짜, 지역, 규격, 가격)
        df = df.drop_duplicates(subset=['date', 'region', 'specification', 'price'])
        after_duplicate_check = len(df)
        if after_region_check != after_duplicate_check:
            log(f"    - 중복 데이터 제거: {after_region_check - after_duplicate_check}개")
        
        log(f"📊 데이터 품질 검증 완료: {original_count}개 → {after_duplicate_check}개")
        
        if df.empty:
            log("📊 품질 검증 후 저장할 데이터가 없습니다.")
            return df
        
        category_groups = df.groupby(['major_category', 'middle_category', 'sub_category', 'specification'])
        
        new_records = []
        total_records = len(df)
        skipped_count = 0
        
        for (major_cat, middle_cat, sub_cat, spec), group_df in category_groups:
            log(f"    - 중복 체크: {major_cat} > {middle_cat} > {sub_cat} > {spec}")
            
            existing_data = self.check_existing_data(
                major_cat, middle_cat, sub_cat, spec, table_name
            )
            
            group_new_count = 0
            group_duplicate_count = 0
            
            for _, record in group_df.iterrows():
                record_key = (record['date'], record['region'], str(record['price']), record['specification'])
                if record_key not in existing_data:
                    new_records.append(record.to_dict())
                    group_new_count += 1
                else:
                    group_duplicate_count += 1
                    skipped_count += 1
            
            if group_duplicate_count > 0:
                log(f"        - 중복 SKIP: {group_duplicate_count}개")
            log(f"        - 그룹 결과: 신규 {group_new_count}개, 중복 {group_duplicate_count}개")
        
        processed_count = len(new_records) + skipped_count
        if new_records:
            log(f"📊 전체 {total_records}개 중 신규 {len(new_records)}개, 중복 {skipped_count}개")
        else:
            if processed_count == total_records:
                log(f"📊 전체 {total_records}개 모두 중복 - 저장할 데이터 없음")
            else:
                # 실제로는 나머지 데이터가 신규 데이터일 가능성이 높음
                unprocessed_count = total_records - processed_count
                log(f"📊 전체 {total_records}개 중 중복 {skipped_count}개, 신규 {unprocessed_count}개 (중복 체크 미완료)")
        
        return pd.DataFrame(new_records)
    
    def save_to_supabase(self, df: pd.DataFrame, table_name: str, check_duplicates: bool = True):
        """DataFrame을 Supabase 테이블에 저장"""
        if df.empty:
            log("저장할 데이터가 없습니다.")
            return 0
        
        if check_duplicates:
            df_to_save = self.filter_new_data_only(df, table_name)
            if df_to_save.empty:
                log("저장할 신규 데이터가 없습니다.")
                return 0
        else:
            df_to_save = df
        
        try:
            records = df_to_save.to_dict(orient='records')
            valid_records = []
            for record in records:
                if self._is_valid_record(record):
                    # 날짜 정규화
                    record['date'] = self._normalize_date(record['date'])
                    
                    # unit 필드가 없으면 기본값 설정
                    if 'unit' not in record or not record['unit']:
                        record['unit'] = 'kg'  # 기본 단위
                    
                    valid_records.append(record)
                else:
                    log(f"유효하지 않은 데이터 제외: {record}")
            
            if not valid_records:
                log("유효한 데이터가 없어 저장을 건너뜁니다.")
                return 0
            
            # Supabase upsert는 기본적으로 500~1000개 단위로 나누어 보내는 것이 안정적
            chunk_size = 500
            total_chunks = (len(valid_records) + chunk_size - 1) // chunk_size
            saved_count = 0
            
            log(f"🔄 Supabase 저장 시작: {len(valid_records)}개 데이터를 {total_chunks}개 청크로 분할")
            
            for i in range(0, len(valid_records), chunk_size):
                chunk = valid_records[i:i + chunk_size]
                chunk_num = i // chunk_size + 1
                
                try:
                    log(f"📤 청크 {chunk_num}/{total_chunks} 저장 시도 중... ({len(chunk)}개 데이터)")
                    response = supabase.table(table_name).upsert(chunk).execute()
                    # Supabase Python 클라이언트는 response.data와 response.count를 반환
                    if response.data is not None:
                        chunk_saved = len(response.data)
                        saved_count += chunk_saved
                        log(f"📦 청크 {chunk_num}/{total_chunks} 저장 완료 ({chunk_saved}개)")
                    else:
                        log(f"⚠️ 청크 {chunk_num}/{total_chunks} 저장 응답이 비어있음", "ERROR")
                        log(f"🔍 응답 상세: {response}", "DEBUG")
                except Exception as chunk_error:
                    log(f"❌ Supabase 저장 실패 (청크 {chunk_num}): {str(chunk_error)}", "ERROR")
                    log(f"🔍 실패한 청크 데이터 샘플: {chunk[0] if chunk else 'None'}", "DEBUG")
                    # 실패한 청크는 건너뛰고 계속 진행
                    continue

            log(f"📊 총 {saved_count}개 데이터 → '{table_name}' 테이블 저장 완료")
            return saved_count
        except Exception as e:
            log(f"❌ Supabase 저장 중 예외 발생: {e}", "ERROR")
            log(f"🔍 예외 상세: {type(e).__name__}: {str(e)}", "DEBUG")
            return 0
    
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
            df = pd.DataFrame(processed_data)
            log(f"📊 저장 시도: {len(df)}개 데이터 → '{table_name}' 테이블")
            
            # 부모 클래스의 save_to_supabase 메서드를 호출하여 중복 제거 및 저장 로직 실행
            actual_saved_count = super().save_to_supabase(df, table_name, check_duplicates=check_duplicates)
            
            # 실제 저장된 개수를 기준으로 메시지 출력
            if actual_saved_count > 0:
                log(f"✅ 저장 완료: {actual_saved_count}개 데이터")
            else:
                log(f"ℹ️ 저장 완료: 신규 데이터 없음 (전체 {len(df)}개 모두 중복)")
            
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
                
                transformed_items.append({
                    'major_category': raw_data['major_category_name'],
                    'middle_category': raw_data['middle_category_name'],
                    'sub_category': raw_data['sub_category_name'],
                    'specification': enhanced_spec,
                    'unit': '원/톤',
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
                    
                    transformed_items.append({
                        'major_category': raw_data['major_category_name'],
                        'middle_category': raw_data['middle_category_name'],
                        'sub_category': raw_data['sub_category_name'],
                        'specification': enhanced_spec,
                        'unit': spec_data.get('unit', '원/톤'),
                        'region': self._normalize_region_name(price_info['region']),
                        'date': price_info['date'],
                        'price': price_value
                    })
        
        return transformed_items


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
