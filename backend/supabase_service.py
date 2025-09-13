import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from supabase import create_client, Client
import asyncio
from functools import wraps
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv()

# 로깅 설정
logging.basicConfig(level=logging.INFO, encoding='utf-8')
logger = logging.getLogger(__name__)

class SupabaseService:
    """Supabase 데이터베이스 서비스 클래스"""
    
    def __init__(self):
        # 환경변수에서 Supabase 설정 읽기
        self.supabase_url = os.getenv('SUPABASE_URL', 'https://your-project.supabase.co')
        self.supabase_key = os.getenv('SUPABASE_ANON_KEY', 'your-anon-key')
        
        try:
            self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
            logger.info("Supabase 클라이언트 초기화 완료")
        except Exception as e:
            logger.error(f"Supabase 클라이언트 초기화 실패: {e}")
            self.supabase = None
    
    def async_to_sync(func):
        """비동기 함수를 동기 함수로 변환하는 데코레이터"""
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            return loop.run_until_complete(func(*args, **kwargs))
        return wrapper
    
    async def get_current_prices(self, materials: List[str]) -> List[Dict]:
        """현재 자재 가격 조회"""
        try:
            if not self.supabase:
                return []
            
            response = self.supabase.table("materialprice_kpi").select("*").in_("material_name", materials).order("date", desc=True).limit(len(materials) * 10).execute()
            
            # 각 자재별 최신 가격만 추출
            latest_prices = {}
            for item in response.data:
                material = item['material_name']
                if material not in latest_prices:
                    latest_prices[material] = item
            
            return list(latest_prices.values())
            
        except Exception as e:
            logger.error(f"현재 가격 조회 중 오류: {e}")
            return []
    
    async def get_all_materials(self) -> List[Dict]:
        """모든 자재 목록 조회"""
        try:
            if not self.supabase:
                return []
            
            response = self.supabase.table("materialprice_kpi").select("material_name, level1_category, level2_category, level3_category, level4_category").execute()
            
            # 중복 제거
            unique_materials = {}
            for item in response.data:
                material_name = item['material_name']
                if material_name not in unique_materials:
                    unique_materials[material_name] = item
            
            return list(unique_materials.values())
            
        except Exception as e:
            logger.error(f"전체 자재 조회 중 오류: {e}")
            return []
    
    async def get_materials_by_category(self, level1: str = None, level2: str = None, level3: str = None) -> List[Dict]:
        """카테고리별 자재 조회"""
        try:
            if not self.supabase:
                return []
            
            query = self.supabase.table("materialprice_kpi").select("*")
            
            if level1:
                query = query.eq("level1_category", level1)
            if level2:
                query = query.eq("level2_category", level2)
            if level3:
                query = query.eq("level3_category", level3)
            
            response = query.execute()
            return response.data
            
        except Exception as e:
            logger.error(f"카테고리별 자재 조회 중 오류: {e}")
            return []
    
    async def get_kpi_material_prices(self, material_name: str, period: str = "30d") -> List[Dict]:
        """특정 자재의 가격 히스토리 조회"""
        try:
            if not self.supabase:
                return []
            
            # 기간 계산
            end_date = datetime.now()
            if period == "7d":
                start_date = end_date - timedelta(days=7)
            elif period == "30d":
                start_date = end_date - timedelta(days=30)
            elif period == "90d":
                start_date = end_date - timedelta(days=90)
            elif period == "1y":
                start_date = end_date - timedelta(days=365)
            else:
                start_date = end_date - timedelta(days=30)
            
            response = self.supabase.table("materialprice_kpi").select("*").eq("material_name", material_name).gte("date", start_date.strftime('%Y-%m-%d')).order("date", desc=False).execute()
            
            return response.data
            
        except Exception as e:
            logger.error(f"자재 가격 히스토리 조회 중 오류: {e}")
            return []
    
    async def get_materialprice_kpi(self, material: str, period: str) -> List[Dict]:
        """KPI 자재 가격 데이터 조회"""
        return await self.get_kpi_material_prices(material, period)
    
    async def get_all_categories(self) -> List[Dict]:
        """모든 카테고리 조회"""
        try:
            if not self.supabase:
                return []
            
            response = self.supabase.table("materialprice_kpi").select("level1_category, level2_category, level3_category, level4_category").execute()
            
            # 중복 제거 및 계층 구조 생성
            categories = set()
            for item in response.data:
                if item.get('level1_category'):
                    categories.add(item['level1_category'])
                if item.get('level2_category'):
                    categories.add(item['level2_category'])
                if item.get('level3_category'):
                    categories.add(item['level3_category'])
                if item.get('level4_category'):
                    categories.add(item['level4_category'])
            
            return [{'category': cat} for cat in sorted(categories)]
            
        except Exception as e:
            logger.error(f"카테고리 조회 중 오류: {e}")
            return []
    
    async def get_category_hierarchy(self) -> Dict:
        """카테고리 계층 구조 조회"""
        try:
            if not self.supabase:
                return {}
            
            response = self.supabase.table("materialprice_kpi").select("level1_category, level2_category, level3_category, level4_category").execute()
            
            hierarchy = {}
            for item in response.data:
                level1 = item.get('level1_category')
                level2 = item.get('level2_category')
                level3 = item.get('level3_category')
                level4 = item.get('level4_category')
                
                if level1:
                    if level1 not in hierarchy:
                        hierarchy[level1] = {}
                    if level2:
                        if level2 not in hierarchy[level1]:
                            hierarchy[level1][level2] = {}
                        if level3:
                            if level3 not in hierarchy[level1][level2]:
                                hierarchy[level1][level2][level3] = []
                            if level4 and level4 not in hierarchy[level1][level2][level3]:
                                hierarchy[level1][level2][level3].append(level4)
            
            return hierarchy
            
        except Exception as e:
            logger.error(f"카테고리 계층 구조 조회 중 오류: {e}")
            return {}
    
    async def get_materials_by_level1(self, level1: str) -> List[Dict]:
        """Level1 카테고리별 자재 조회"""
        return await self.get_materials_by_category(level1=level1)
    
    async def get_materials_by_level2(self, level1: str, level2: str) -> List[Dict]:
        """Level2 카테고리별 자재 조회"""
        return await self.get_materials_by_category(level1=level1, level2=level2)
    
    async def get_materials_by_level3(self, level1: str, level2: str, level3: str) -> List[Dict]:
        """Level3 카테고리별 자재 조회"""
        return await self.get_materials_by_category(level1=level1, level2=level2, level3=level3)
    
    async def get_materials_by_level4(self, level1: str, level2: str, level3: str, level4: str) -> List[Dict]:
        """Level4 카테고리별 자재 조회"""
        try:
            if not self.supabase:
                return []
            
            response = self.supabase.table("materialprice_kpi").select("*").eq("level1_category", level1).eq("level2_category", level2).eq("level3_category", level3).eq("level4_category", level4).execute()
            
            return response.data
            
        except Exception as e:
            logger.error(f"Level4 카테고리별 자재 조회 중 오류: {e}")
            return []
    
    async def get_materials_by_date_range(self, start_date: str, end_date: str, materials: List[str] = None) -> List[Dict]:
        """날짜 범위별 자재 가격 조회"""
        try:
            if not self.supabase:
                return []
            
            query = self.supabase.table("materialprice_kpi").select("*").gte("date", start_date).lte("date", end_date)
            
            if materials:
                query = query.in_("material_name", materials)
            
            response = query.order("date", desc=False).execute()
            return response.data
            
        except Exception as e:
            logger.error(f"날짜 범위별 자재 조회 중 오류: {e}")
            return []
    
    async def get_kpi_materials_by_category(self, level1: str = None, level2: str = None, level3: str = None, level4: str = None) -> List[Dict]:
        """KPI 카테고리별 자재 조회"""
        try:
            if not self.supabase:
                return []
            
            query = self.supabase.table("materialprice_kpi").select("material_name, level1_category, level2_category, level3_category, level4_category")
            
            if level1:
                query = query.eq("level1_category", level1)
            if level2:
                query = query.eq("level2_category", level2)
            if level3:
                query = query.eq("level3_category", level3)
            if level4:
                query = query.eq("level4_category", level4)
            
            response = query.execute()
            
            # 중복 제거
            unique_materials = {}
            for item in response.data:
                material_name = item['material_name']
                if material_name not in unique_materials:
                    unique_materials[material_name] = item
            
            return list(unique_materials.values())
            
        except Exception as e:
            logger.error(f"KPI 카테고리별 자재 조회 중 오류: {e}")
            return []
    
    async def get_data_date_range(self, materials: List[str]) -> Dict:
        """자재 데이터의 날짜 범위 조회"""
        try:
            if not self.supabase:
                return {'start_date': None, 'end_date': None}
            
            query = self.supabase.table("materialprice_kpi").select("date")
            
            if materials:
                query = query.in_("material_name", materials)
            
            response = query.order("date", desc=False).execute()
            
            if response.data:
                dates = [item['date'] for item in response.data]
                return {
                    'start_date': min(dates),
                    'end_date': max(dates)
                }
            
            return {'start_date': None, 'end_date': None}
            
        except Exception as e:
            logger.error(f"날짜 범위 조회 중 오류: {e}")
            return {'start_date': None, 'end_date': None}
    
    async def get_aggregated_price_data(self, materials: List[str], interval: str, start_date: str = None, end_date: str = None) -> List[Dict]:
        """집계된 가격 데이터 조회 (주간/월간/연간 평균)"""
        try:
            if not self.supabase:
                return []
            
            query = self.supabase.table("materialprice_kpi").select("*").in_("material_name", materials)
            
            if start_date:
                query = query.gte("date", start_date)
            if end_date:
                query = query.lte("date", end_date)
            
            response = query.order("date", desc=False).execute()
            raw_data = response.data
            
            # 간격에 따른 데이터 집계
            if interval == "weekly":
                return self._aggregate_weekly(raw_data)
            elif interval == "monthly":
                return self._aggregate_monthly(raw_data)
            elif interval == "yearly":
                return self._aggregate_yearly(raw_data)
            else:
                return raw_data
            
        except Exception as e:
            logger.error(f"집계 가격 데이터 조회 중 오류: {e}")
            return []
    
    def _aggregate_weekly(self, data: List[Dict]) -> List[Dict]:
        """주간 평균 집계"""
        from collections import defaultdict
        import datetime as dt
        
        weekly_data = defaultdict(lambda: defaultdict(list))
        
        for item in data:
            date = dt.datetime.strptime(item['date'], '%Y-%m-%d')
            # ISO 주차 계산 (월요일 시작)
            year, week, _ = date.isocalendar()
            week_key = f"{year}-W{week:02d}"
            material = item['material_name']
            
            weekly_data[week_key][material].append(float(item['price']))
        
        result = []
        for week_key, materials in weekly_data.items():
            for material, prices in materials.items():
                avg_price = sum(prices) / len(prices)
                # 주차의 월요일 날짜 계산
                year, week = week_key.split('-W')
                monday = dt.datetime.strptime(f"{year}-W{week}-1", "%Y-W%W-%w")
                
                result.append({
                    'date': monday.strftime('%Y-%m-%d'),
                    'material_name': material,
                    'price': round(avg_price, 2),
                    'unit': data[0].get('unit', 'KRW/kg') if data else 'KRW/kg'
                })
        
        return sorted(result, key=lambda x: (x['date'], x['material_name']))
    
    def _aggregate_monthly(self, data: List[Dict]) -> List[Dict]:
        """월간 평균 집계"""
        from collections import defaultdict
        import datetime as dt
        
        monthly_data = defaultdict(lambda: defaultdict(list))
        
        for item in data:
            date = dt.datetime.strptime(item['date'], '%Y-%m-%d')
            month_key = date.strftime('%Y-%m')
            material = item['material_name']
            
            monthly_data[month_key][material].append(float(item['price']))
        
        result = []
        for month_key, materials in monthly_data.items():
            for material, prices in materials.items():
                avg_price = sum(prices) / len(prices)
                
                result.append({
                    'date': f"{month_key}-01",
                    'material_name': material,
                    'price': round(avg_price, 2),
                    'unit': data[0].get('unit', 'KRW/kg') if data else 'KRW/kg'
                })
        
        return sorted(result, key=lambda x: (x['date'], x['material_name']))
    
    def _aggregate_yearly(self, data: List[Dict]) -> List[Dict]:
        """연간 평균 집계"""
        from collections import defaultdict
        import datetime as dt
        
        yearly_data = defaultdict(lambda: defaultdict(list))
        
        for item in data:
            date = dt.datetime.strptime(item['date'], '%Y-%m-%d')
            year_key = str(date.year)
            material = item['material_name']
            
            yearly_data[year_key][material].append(float(item['price']))
        
        result = []
        for year_key, materials in yearly_data.items():
            for material, prices in materials.items():
                avg_price = sum(prices) / len(prices)
                
                result.append({
                    'date': f"{year_key}-01-01",
                    'material_name': material,
                    'price': round(avg_price, 2),
                    'unit': data[0].get('unit', 'KRW/kg') if data else 'KRW/kg'
                })
        
        return sorted(result, key=lambda x: (x['date'], x['material_name']))
    
    async def get_chart_data_by_level4(self, level4_category: str, interval: str, start_date: str = None, end_date: str = None) -> List[Dict]:
        """Level4 카테고리별 차트 데이터 조회"""
        try:
            if not self.supabase:
                return []
            
            query = self.supabase.table("materialprice_kpi").select("*").eq("level4_category", level4_category)
            
            if start_date:
                query = query.gte("date", start_date)
            if end_date:
                query = query.lte("date", end_date)
            
            response = query.order("date", desc=False).execute()
            return response.data
            
        except Exception as e:
            logger.error(f"Level4 차트 데이터 조회 중 오류: {e}")
            return []
    
    async def get_top_materials_by_count(self, limit: int = 20) -> List[Dict]:
        """데이터 개수 기준 상위 자재 조회"""
        try:
            if not self.supabase:
                return []
            
            response = self.supabase.table("materialprice_kpi").select("material_name").execute()
            
            # 자재별 개수 계산
            material_counts = {}
            for item in response.data:
                material = item['material_name']
                material_counts[material] = material_counts.get(material, 0) + 1
            
            # 상위 자재 정렬
            top_materials = sorted(material_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
            
            return [{'material_name': material, 'count': count} for material, count in top_materials]
            
        except Exception as e:
            logger.error(f"상위 자재 조회 중 오류: {e}")
            return []
    
    async def get_category_summary(self) -> Dict:
        """카테고리 요약 정보 조회"""
        try:
            if not self.supabase:
                return {}
            
            response = self.supabase.table("materialprice_kpi").select("level1_category, level2_category, level3_category, level4_category").execute()
            
            summary = {
                'level1_count': len(set(item['level1_category'] for item in response.data if item.get('level1_category'))),
                'level2_count': len(set(item['level2_category'] for item in response.data if item.get('level2_category'))),
                'level3_count': len(set(item['level3_category'] for item in response.data if item.get('level3_category'))),
                'level4_count': len(set(item['level4_category'] for item in response.data if item.get('level4_category')))
            }
            
            return summary
            
        except Exception as e:
            logger.error(f"카테고리 요약 조회 중 오류: {e}")
            return {}
    
    async def get_material_specifications(self, material_name: str) -> List[Dict]:
        """자재 규격 정보 조회"""
        try:
            if not self.supabase:
                return []
            
            response = self.supabase.table("materialprice_kpi").select("*").eq("material_name", material_name).execute()
            return response.data
            
        except Exception as e:
            logger.error(f"자재 규격 조회 중 오류: {e}")
            return []
    
    async def get_unique_materials(self) -> List[Dict]:
        """고유 자재 목록 조회"""
        try:
            if not self.supabase:
                return []
            
            response = self.supabase.table("materialprice_kpi").select("material_name").execute()
            
            unique_materials = list(set(item['material_name'] for item in response.data))
            return [{'material_name': material} for material in sorted(unique_materials)]
            
        except Exception as e:
            logger.error(f"고유 자재 조회 중 오류: {e}")
            return []
    
    async def get_total_materials_count(self) -> int:
        """전체 자재 개수 조회"""
        try:
            if not self.supabase:
                return 0
            
            response = self.supabase.table("materialprice_kpi").select("material_name", count="exact").execute()
            return response.count or 0
            
        except Exception as e:
            logger.error(f"전체 자재 개수 조회 중 오류: {e}")
            return 0
    
    async def get_category_level_stats(self) -> Dict:
        """카테고리 레벨별 통계 조회"""
        try:
            if not self.supabase:
                return {}
            
            response = self.supabase.table("materialprice_kpi").select("level1_category, level2_category, level3_category, level4_category").execute()
            
            stats = {
                'level1': {},
                'level2': {},
                'level3': {},
                'level4': {}
            }
            
            for item in response.data:
                for level in ['level1', 'level2', 'level3', 'level4']:
                    category = item.get(f'{level}_category')
                    if category:
                        stats[level][category] = stats[level].get(category, 0) + 1
            
            return stats
            
        except Exception as e:
            logger.error(f"카테고리 레벨 통계 조회 중 오류: {e}")
            return {}
    
    async def get_materials_missing_level4(self, limit: int = 50) -> List[Dict]:
        """Level4가 없는 자재 조회"""
        try:
            if not self.supabase:
                return []
            
            response = self.supabase.table("materialprice_kpi").select("*").is_("level4_category", "null").limit(limit).execute()
            return response.data
            
        except Exception as e:
            logger.error(f"Level4 누락 자재 조회 중 오류: {e}")
            return []
    
    async def get_level1_category_stats(self) -> List[Dict]:
        """Level1 카테고리 통계 조회"""
        try:
            if not self.supabase:
                return []
            
            response = self.supabase.table("materialprice_kpi").select("level1_category").execute()
            
            stats = {}
            for item in response.data:
                category = item.get('level1_category')
                if category:
                    stats[category] = stats.get(category, 0) + 1
            
            return [{'category': cat, 'count': count} for cat, count in stats.items()]
            
        except Exception as e:
            logger.error(f"Level1 카테고리 통계 조회 중 오류: {e}")
            return []
    
    async def get_kpi_level1_categories(self) -> List[Dict]:
        """KPI Level1 카테고리 조회"""
        try:
            if not self.supabase:
                return []
            
            response = self.supabase.table("materialprice_kpi").select("level1_category").execute()
            
            categories = list(set(item['level1_category'] for item in response.data if item.get('level1_category')))
            return [{'category': cat} for cat in sorted(categories)]
            
        except Exception as e:
            logger.error(f"KPI Level1 카테고리 조회 중 오류: {e}")
            return []
    
    async def get_kpi_level2_categories(self, level1_code: str) -> List[Dict]:
        """KPI Level2 카테고리 조회"""
        try:
            if not self.supabase:
                return []
            
            response = self.supabase.table("materialprice_kpi").select("level2_category").eq("level1_category", level1_code).execute()
            
            categories = list(set(item['level2_category'] for item in response.data if item.get('level2_category')))
            return [{'category': cat} for cat in sorted(categories)]
            
        except Exception as e:
            logger.error(f"KPI Level2 카테고리 조회 중 오류: {e}")
            return []
    
    async def get_kpi_level3_categories(self, level1_code: str, level2_code: str) -> List[Dict]:
        """KPI Level3 카테고리 조회"""
        try:
            if not self.supabase:
                return []
            
            response = self.supabase.table("materialprice_kpi").select("level3_category").eq("level1_category", level1_code).eq("level2_category", level2_code).execute()
            
            categories = list(set(item['level3_category'] for item in response.data if item.get('level3_category')))
            return [{'category': cat} for cat in sorted(categories)]
            
        except Exception as e:
            logger.error(f"KPI Level3 카테고리 조회 중 오류: {e}")
            return []
    
    async def get_kpi_level4_categories(self, level1_code: str, level2_code: str, level3_code: str) -> List[Dict]:
        """KPI Level4 카테고리 조회"""
        try:
            if not self.supabase:
                return []
            
            response = self.supabase.table("materialprice_kpi").select("level4_category").eq("level1_category", level1_code).eq("level2_category", level2_code).eq("level3_category", level3_code).execute()
            
            categories = list(set(item['level4_category'] for item in response.data if item.get('level4_category')))
            return [{'category': cat} for cat in sorted(categories)]
            
        except Exception as e:
            logger.error(f"KPI Level4 카테고리 조회 중 오류: {e}")
            return []

# 전역 서비스 인스턴스
supabase_service = SupabaseService()