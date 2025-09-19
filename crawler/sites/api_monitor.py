"""
Supabase API 사용량 모니터링 및 제한 관리 모듈
"""
import time
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
from supabase import Client


@dataclass
class ApiUsageStats:
    """API 사용량 통계"""
    total_calls: int = 0
    select_calls: int = 0
    insert_calls: int = 0
    delete_calls: int = 0
    update_calls: int = 0
    start_time: float = 0
    last_call_time: float = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ApiUsageStats':
        return cls(**data)


class SupabaseApiMonitor:
    """Supabase API 호출 모니터링 및 제한 관리"""
    
    def __init__(self, 
                 supabase_client: Client,
                 max_calls_per_minute: int = 100,
                 max_calls_per_hour: int = 1000,
                 log_file: str = "api_usage.log"):
        self.client = supabase_client
        self.max_calls_per_minute = max_calls_per_minute
        self.max_calls_per_hour = max_calls_per_hour
        self.log_file = log_file
        
        # 통계 초기화
        self.stats = ApiUsageStats(start_time=time.time())
        self.minute_calls = []  # 분당 호출 기록
        self.hour_calls = []    # 시간당 호출 기록
        
        # 원본 메서드 백업 및 래핑
        self._wrap_supabase_methods()
        
        # 로그 파일 초기화
        self._init_log_file()
    
    def _wrap_supabase_methods(self):
        """Supabase 클라이언트 메서드를 래핑하여 모니터링"""
        original_table = self.client.table
        
        def monitored_table(table_name: str):
            table_obj = original_table(table_name)
            
            # SELECT 메서드 래핑
            original_select = table_obj.select
            def wrapped_select(*args, **kwargs):
                self._record_api_call('SELECT', table_name)
                return original_select(*args, **kwargs)
            table_obj.select = wrapped_select
            
            # INSERT 메서드 래핑
            original_insert = table_obj.insert
            def wrapped_insert(*args, **kwargs):
                self._record_api_call('INSERT', table_name)
                return original_insert(*args, **kwargs)
            table_obj.insert = wrapped_insert
            
            # DELETE 메서드 래핑
            original_delete = table_obj.delete
            def wrapped_delete(*args, **kwargs):
                self._record_api_call('DELETE', table_name)
                return original_delete(*args, **kwargs)
            table_obj.delete = wrapped_delete
            
            # UPDATE 메서드 래핑
            original_update = table_obj.update
            def wrapped_update(*args, **kwargs):
                self._record_api_call('UPDATE', table_name)
                return original_update(*args, **kwargs)
            table_obj.update = wrapped_update
            
            return table_obj
        
        # 클라이언트의 table 메서드 교체
        self.client.table = monitored_table
    
    def _record_api_call(self, method: str, table_name: str):
        """API 호출 기록 및 제한 확인"""
        current_time = time.time()
        
        # 통계 업데이트
        self.stats.total_calls += 1
        self.stats.last_call_time = current_time
        
        if method == 'SELECT':
            self.stats.select_calls += 1
        elif method == 'INSERT':
            self.stats.insert_calls += 1
        elif method == 'DELETE':
            self.stats.delete_calls += 1
        elif method == 'UPDATE':
            self.stats.update_calls += 1
        
        # 시간별 호출 기록
        self.minute_calls.append(current_time)
        self.hour_calls.append(current_time)
        
        # 1분 이전 기록 제거
        minute_ago = current_time - 60
        self.minute_calls = [t for t in self.minute_calls if t > minute_ago]
        
        # 1시간 이전 기록 제거
        hour_ago = current_time - 3600
        self.hour_calls = [t for t in self.hour_calls if t > hour_ago]
        
        # 제한 확인
        self._check_rate_limits()
        
        # 로그 기록
        self._log_api_call(method, table_name, current_time)
    
    def _check_rate_limits(self):
        """API 호출 제한 확인"""
        minute_count = len(self.minute_calls)
        hour_count = len(self.hour_calls)
        
        if minute_count > self.max_calls_per_minute:
            print(f"⚠️  분당 API 호출 제한 초과: {minute_count}/{self.max_calls_per_minute}")
        
        if hour_count > self.max_calls_per_hour:
            print(f"⚠️  시간당 API 호출 제한 초과: {hour_count}/{self.max_calls_per_hour}")
    
    def _init_log_file(self):
        """로그 파일 초기화"""
        if not os.path.exists(self.log_file):
            with open(self.log_file, 'w', encoding='utf-8') as f:
                f.write("timestamp,method,table,total_calls,minute_calls,hour_calls\n")
    
    def _log_api_call(self, method: str, table_name: str, timestamp: float):
        """API 호출을 로그 파일에 기록"""
        dt = datetime.fromtimestamp(timestamp)
        minute_count = len(self.minute_calls)
        hour_count = len(self.hour_calls)
        
        log_entry = (f"{dt.isoformat()},{method},{table_name},"
                    f"{self.stats.total_calls},{minute_count},{hour_count}\n")
        
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(log_entry)
        
        # 콘솔 출력 (상세 모드)
        if self.stats.total_calls % 10 == 0:  # 10회마다 출력
            print(f"📡 API 호출 #{self.stats.total_calls}: {method} {table_name} "
                  f"(분당: {minute_count}, 시간당: {hour_count})")
    
    def get_usage_summary(self) -> Dict[str, Any]:
        """사용량 요약 정보 반환"""
        current_time = time.time()
        duration = current_time - self.stats.start_time
        
        return {
            'total_calls': self.stats.total_calls,
            'calls_by_method': {
                'SELECT': self.stats.select_calls,
                'INSERT': self.stats.insert_calls,
                'DELETE': self.stats.delete_calls,
                'UPDATE': self.stats.update_calls
            },
            'duration_seconds': duration,
            'calls_per_minute': len(self.minute_calls),
            'calls_per_hour': len(self.hour_calls),
            'average_calls_per_minute': (self.stats.total_calls / duration * 60) if duration > 0 else 0,
            'rate_limits': {
                'max_per_minute': self.max_calls_per_minute,
                'max_per_hour': self.max_calls_per_hour,
                'current_minute_usage': len(self.minute_calls),
                'current_hour_usage': len(self.hour_calls)
            }
        }
    
    def print_usage_summary(self):
        """사용량 요약을 콘솔에 출력"""
        summary = self.get_usage_summary()
        
        print("\n" + "="*60)
        print("📊 Supabase API 사용량 요약")
        print("="*60)
        print(f"🔢 총 API 호출: {summary['total_calls']}회")
        print(f"⏱️  실행 시간: {summary['duration_seconds']:.1f}초")
        print(f"📈 평균 호출/분: {summary['average_calls_per_minute']:.1f}회")
        print()
        print("📋 메서드별 호출 횟수:")
        for method, count in summary['calls_by_method'].items():
            print(f"   {method}: {count}회")
        print()
        print("🚦 현재 사용률:")
        print(f"   분당: {summary['rate_limits']['current_minute_usage']}/{summary['rate_limits']['max_per_minute']}회")
        print(f"   시간당: {summary['rate_limits']['current_hour_usage']}/{summary['rate_limits']['max_per_hour']}회")
        print("="*60)
    
    def save_stats(self, filename: str = "api_stats.json"):
        """통계를 JSON 파일로 저장"""
        stats_data = {
            'stats': self.stats.to_dict(),
            'summary': self.get_usage_summary(),
            'timestamp': datetime.now().isoformat()
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(stats_data, f, indent=2, ensure_ascii=False)
        
        print(f"📁 API 사용량 통계가 {filename}에 저장되었습니다.")


def create_monitored_supabase_client(supabase_client: Client, 
                                   max_calls_per_minute: int = 100,
                                   max_calls_per_hour: int = 1000) -> SupabaseApiMonitor:
    """모니터링이 적용된 Supabase 클라이언트 생성"""
    return SupabaseApiMonitor(
        supabase_client=supabase_client,
        max_calls_per_minute=max_calls_per_minute,
        max_calls_per_hour=max_calls_per_hour
    )