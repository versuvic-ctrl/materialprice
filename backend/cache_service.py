import redis
import json
import logging
from typing import Any, Optional, Dict, List
from datetime import datetime, timedelta
import os

# 로깅 설정
logging.basicConfig(level=logging.INFO, encoding='utf-8')
logger = logging.getLogger(__name__)

class CacheService:
    """Redis 캐시 서비스 클래스"""
    
    def __init__(self):
        # Redis 연결 설정
        self.redis_host = os.getenv('REDIS_HOST', 'localhost')
        self.redis_port = int(os.getenv('REDIS_PORT', 6379))
        self.redis_db = int(os.getenv('REDIS_DB', 0))
        self.redis_password = os.getenv('REDIS_PASSWORD', None)
        
        try:
            self.redis_client = redis.Redis(
                host=self.redis_host,
                port=self.redis_port,
                db=self.redis_db,
                password=self.redis_password,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            # 연결 테스트
            self.redis_client.ping()
            logger.info("Redis 캐시 서비스 초기화 완료")
            self.is_connected = True
        except Exception as e:
            logger.warning(f"Redis 연결 실패, 캐시 비활성화: {e}")
            self.redis_client = None
            self.is_connected = False
    
    def _generate_key(self, prefix: str, *args) -> str:
        """캐시 키 생성"""
        key_parts = [prefix] + [str(arg) for arg in args if arg is not None]
        return ":".join(key_parts)
    
    def set_cache(self, key: str, value: Any, expire_seconds: int = 3600) -> bool:
        """캐시 데이터 저장"""
        if not self.is_connected:
            return False
        
        try:
            serialized_value = json.dumps(value, ensure_ascii=False, default=str)
            self.redis_client.setex(key, expire_seconds, serialized_value)
            logger.debug(f"캐시 저장 완료: {key}")
            return True
        except Exception as e:
            logger.error(f"캐시 저장 실패 {key}: {e}")
            return False
    
    def get_cache(self, key: str) -> Optional[Any]:
        """캐시 데이터 조회"""
        if not self.is_connected:
            return None
        
        try:
            cached_value = self.redis_client.get(key)
            if cached_value:
                logger.debug(f"캐시 히트: {key}")
                return json.loads(cached_value)
            logger.debug(f"캐시 미스: {key}")
            return None
        except Exception as e:
            logger.error(f"캐시 조회 실패 {key}: {e}")
            return None
    
    def delete_cache(self, key: str) -> bool:
        """캐시 데이터 삭제"""
        if not self.is_connected:
            return False
        
        try:
            result = self.redis_client.delete(key)
            logger.debug(f"캐시 삭제: {key}")
            return result > 0
        except Exception as e:
            logger.error(f"캐시 삭제 실패 {key}: {e}")
            return False
    
    def clear_pattern(self, pattern: str) -> int:
        """패턴에 맞는 캐시 데이터 일괄 삭제"""
        if not self.is_connected:
            return 0
        
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                deleted_count = self.redis_client.delete(*keys)
                logger.info(f"패턴 캐시 삭제: {pattern}, 삭제된 키 수: {deleted_count}")
                return deleted_count
            return 0
        except Exception as e:
            logger.error(f"패턴 캐시 삭제 실패 {pattern}: {e}")
            return 0
    
    def exists(self, key: str) -> bool:
        """캐시 키 존재 여부 확인"""
        if not self.is_connected:
            return False
        
        try:
            return self.redis_client.exists(key) > 0
        except Exception as e:
            logger.error(f"캐시 존재 확인 실패 {key}: {e}")
            return False
    
    def get_ttl(self, key: str) -> int:
        """캐시 TTL 조회"""
        if not self.is_connected:
            return -1
        
        try:
            return self.redis_client.ttl(key)
        except Exception as e:
            logger.error(f"TTL 조회 실패 {key}: {e}")
            return -1
    
    def extend_ttl(self, key: str, expire_seconds: int) -> bool:
        """캐시 TTL 연장"""
        if not self.is_connected:
            return False
        
        try:
            return self.redis_client.expire(key, expire_seconds)
        except Exception as e:
            logger.error(f"TTL 연장 실패 {key}: {e}")
            return False
    
    async def get_or_set(self, key: str, fetch_func, expire_seconds: int = 3600):
        """캐시에서 조회하거나 새로 가져와서 저장"""
        # 캐시에서 조회 시도
        cached_data = self.get_cache(key)
        if cached_data is not None:
            return cached_data
        
        # 캐시에 없으면 새로 가져오기
        try:
            if callable(fetch_func):
                import asyncio
                if asyncio.iscoroutinefunction(fetch_func):
                    fresh_data = await fetch_func()
                else:
                    fresh_data = fetch_func()
            else:
                fresh_data = fetch_func
            
            # 새로 가져온 데이터를 캐시에 저장
            self.set_cache(key, fresh_data, expire_seconds)
            return fresh_data
        except Exception as e:
            logger.error(f"데이터 가져오기 실패 {key}: {e}")
            return None
    
    # 자재 가격 관련 캐시 메서드들
    def get_material_prices_cache_key(self, materials: List[str]) -> str:
        """자재 가격 캐시 키 생성"""
        materials_str = "|".join(sorted(materials))
        return self._generate_key("material_prices", materials_str)
    
    def get_kpi_material_cache_key(self, material: str, period: str) -> str:
        """KPI 자재 캐시 키 생성"""
        return self._generate_key("kpi_material", material, period)
    
    def get_category_cache_key(self, level1: str = None, level2: str = None, level3: str = None, level4: str = None) -> str:
        """카테고리 캐시 키 생성"""
        return self._generate_key("category", level1, level2, level3, level4)
    
    def get_chart_data_cache_key(self, materials: List[str], interval: str, start_date: str = None, end_date: str = None) -> str:
        """차트 데이터 캐시 키 생성"""
        materials_str = "|".join(sorted(materials))
        return self._generate_key("chart_data", materials_str, interval, start_date, end_date)
    
    def get_level4_chart_cache_key(self, level4_category: str, interval: str, start_date: str = None, end_date: str = None) -> str:
        """Level4 차트 캐시 키 생성"""
        return self._generate_key("level4_chart", level4_category, interval, start_date, end_date)
    
    def get_top_materials_cache_key(self, limit: int) -> str:
        """상위 자재 캐시 키 생성"""
        return self._generate_key("top_materials", limit)
    
    def get_category_hierarchy_cache_key(self) -> str:
        """카테고리 계층 캐시 키 생성"""
        return self._generate_key("category_hierarchy")
    
    def get_all_materials_cache_key(self) -> str:
        """전체 자재 캐시 키 생성"""
        return self._generate_key("all_materials")
    
    def get_unique_materials_cache_key(self) -> str:
        """고유 자재 캐시 키 생성"""
        return self._generate_key("unique_materials")
    
    def get_category_summary_cache_key(self) -> str:
        """카테고리 요약 캐시 키 생성"""
        return self._generate_key("category_summary")
    
    def get_level1_stats_cache_key(self) -> str:
        """Level1 통계 캐시 키 생성"""
        return self._generate_key("level1_stats")
    
    def get_kpi_categories_cache_key(self, level: str, *args) -> str:
        """KPI 카테고리 캐시 키 생성"""
        return self._generate_key(f"kpi_{level}_categories", *args)
    
    def get_materials_missing_level4_cache_key(self, limit: int) -> str:
        """Level4 누락 자재 캐시 키 생성"""
        return self._generate_key("missing_level4", limit)
    
    def get_date_range_cache_key(self, materials: List[str]) -> str:
        """날짜 범위 캐시 키 생성"""
        materials_str = "|".join(sorted(materials))
        return self._generate_key("date_range", materials_str)
    
    def get_material_specs_cache_key(self, material_name: str) -> str:
        """자재 규격 캐시 키 생성"""
        return self._generate_key("material_specs", material_name)
    
    def get_total_count_cache_key(self) -> str:
        """전체 개수 캐시 키 생성"""
        return self._generate_key("total_count")
    
    def get_category_level_stats_cache_key(self) -> str:
        """카테고리 레벨 통계 캐시 키 생성"""
        return self._generate_key("category_level_stats")
    
    # 캐시 무효화 메서드들
    def invalidate_material_caches(self) -> int:
        """자재 관련 캐시 무효화"""
        patterns = [
            "material_prices:*",
            "kpi_material:*",
            "all_materials",
            "unique_materials",
            "total_count",
            "material_specs:*"
        ]
        
        total_deleted = 0
        for pattern in patterns:
            total_deleted += self.clear_pattern(pattern)
        
        logger.info(f"자재 관련 캐시 무효화 완료: {total_deleted}개 키 삭제")
        return total_deleted
    
    def invalidate_category_caches(self) -> int:
        """카테고리 관련 캐시 무효화"""
        patterns = [
            "category:*",
            "category_hierarchy",
            "category_summary",
            "category_level_stats",
            "level1_stats",
            "kpi_*_categories:*",
            "missing_level4:*"
        ]
        
        total_deleted = 0
        for pattern in patterns:
            total_deleted += self.clear_pattern(pattern)
        
        logger.info(f"카테고리 관련 캐시 무효화 완료: {total_deleted}개 키 삭제")
        return total_deleted
    
    def invalidate_chart_caches(self) -> int:
        """차트 관련 캐시 무효화"""
        patterns = [
            "chart_data:*",
            "level4_chart:*",
            "top_materials:*",
            "date_range:*"
        ]
        
        total_deleted = 0
        for pattern in patterns:
            total_deleted += self.clear_pattern(pattern)
        
        logger.info(f"차트 관련 캐시 무효화 완료: {total_deleted}개 키 삭제")
        return total_deleted
    
    def invalidate_all_caches(self) -> int:
        """모든 캐시 무효화"""
        if not self.is_connected:
            return 0
        
        try:
            self.redis_client.flushdb()
            logger.info("모든 캐시 무효화 완료")
            return 1
        except Exception as e:
            logger.error(f"전체 캐시 무효화 실패: {e}")
            return 0
    
    # 캐시 통계 메서드들
    def get_cache_stats(self) -> Dict:
        """캐시 통계 조회"""
        if not self.is_connected:
            return {'connected': False}
        
        try:
            info = self.redis_client.info()
            return {
                'connected': True,
                'used_memory': info.get('used_memory_human', 'N/A'),
                'connected_clients': info.get('connected_clients', 0),
                'total_commands_processed': info.get('total_commands_processed', 0),
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0),
                'hit_rate': self._calculate_hit_rate(info.get('keyspace_hits', 0), info.get('keyspace_misses', 0))
            }
        except Exception as e:
            logger.error(f"캐시 통계 조회 실패: {e}")
            return {'connected': False, 'error': str(e)}
    
    def _calculate_hit_rate(self, hits: int, misses: int) -> float:
        """캐시 히트율 계산"""
        total = hits + misses
        if total == 0:
            return 0.0
        return round((hits / total) * 100, 2)
    
    def get_cache_keys_count(self) -> int:
        """캐시 키 개수 조회"""
        if not self.is_connected:
            return 0
        
        try:
            return self.redis_client.dbsize()
        except Exception as e:
            logger.error(f"캐시 키 개수 조회 실패: {e}")
            return 0
    
    def get_cache_keys_by_pattern(self, pattern: str) -> List[str]:
        """패턴에 맞는 캐시 키 목록 조회"""
        if not self.is_connected:
            return []
        
        try:
            return self.redis_client.keys(pattern)
        except Exception as e:
            logger.error(f"패턴 키 조회 실패 {pattern}: {e}")
            return []
    
    # 연결 관리 메서드들
    def reconnect(self) -> bool:
        """Redis 재연결 시도"""
        try:
            self.redis_client = redis.Redis(
                host=self.redis_host,
                port=self.redis_port,
                db=self.redis_db,
                password=self.redis_password,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            self.redis_client.ping()
            self.is_connected = True
            logger.info("Redis 재연결 성공")
            return True
        except Exception as e:
            logger.error(f"Redis 재연결 실패: {e}")
            self.is_connected = False
            return False
    
    def close_connection(self):
        """Redis 연결 종료"""
        if self.redis_client:
            try:
                self.redis_client.close()
                logger.info("Redis 연결 종료")
            except Exception as e:
                logger.error(f"Redis 연결 종료 실패: {e}")
            finally:
                self.is_connected = False
    
    def __del__(self):
        """소멸자 - 연결 정리"""
        self.close_connection()

# 캐시 시간 상수 정의
CACHE_TIMES = {
    'short': 300,      # 5분
    'medium': 1800,    # 30분
    'long': 3600,      # 1시간
    'very_long': 7200, # 2시간
    'daily': 86400,    # 24시간
    'CURRENT_PRICES': 1800,    # 30분
    'DASHBOARD_SUMMARY': 3600  # 1시간
}

# 전역 캐시 서비스 인스턴스
cache_service = CacheService()