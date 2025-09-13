from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
import math
from fastapi import FastAPI, HTTPException
import logging
import asyncio
import uvicorn
import urllib.parse
import unicodedata
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase_service import supabase_service
from cache_service import cache_service, CACHE_TIMES

# 환경변수 로드
load_dotenv()

# Supabase 클라이언트 직접 접근
supabase = supabase_service.supabase

# 로깅 설정
logging.basicConfig(level=logging.INFO, encoding='utf-8')
logger = logging.getLogger(__name__)

app = FastAPI(title="Materials Dashboard API", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Next.js 개발 서버(3000 고정)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 앱 시작/종료 이벤트
@app.on_event("startup")
async def startup_event():
    """앱 시작 시 초기화"""
    logger.info("애플리케이션 시작 완료")

@app.on_event("shutdown")
async def shutdown_event():
    """앱 종료 시 정리"""
    cache_service.close_connection()
    logger.info("애플리케이션 종료 완료")

# 데이터 모델
class MaterialPrice(BaseModel):
    material: str
    price: float
    unit: str
    date: str

class TankCalculation(BaseModel):
    diameter: float
    height: float
    headType: Optional[str] = "flat"
    material: Optional[str] = "carbon"

class NPSHCalculation(BaseModel):
    atmospheric_pressure: float
    vapor_pressure: float
    static_head: float
    friction_loss: float

class AffinityCalculation(BaseModel):
    n1: float  # 기존 회전수
    n2: float  # 새 회전수
    q1: float  # 기존 유량
    h1: float  # 기존 양정
    p1: float  # 기존 동력



# API 엔드포인트
@app.get("/")
async def root():
    return {"message": "Materials Dashboard API"}

@app.get("/materials/current")
async def get_current_prices(materials: str = "SUS304,SUS316,SS275,H빔,각파이프"):
    """현재 자재 가격 조회 (캐시 적용)"""
    try:
        # 캐시 키 생성
        cache_key = cache_service._generate_key("current_prices", materials)
        
        # 캐시에서 조회하거나 새로 가져오기
        async def fetch_current_prices():
            material_list = materials.split(",")
            db_data = await supabase_service.get_current_prices(material_list)
            if db_data:
                # DB 데이터를 Record 형태로 변환하고 change를 퍼센트 문자열로 변환
                result = {}
                for item in db_data:
                    change_value = item.get('change', 0)
                    change_str = f"{change_value:+.1f}%" if isinstance(change_value, (int, float)) else str(change_value)
                    result[item['material']] = {
                        "material": item['material'],
                        "price": item['price'],
                        "unit": item['unit'],
                        "change": change_str
                    }
                return result
            else:
                raise HTTPException(status_code=404, detail="현재 가격 데이터를 찾을 수 없습니다")
        
        return await cache_service.get_or_set(
            cache_key, 
            fetch_current_prices, 
            expire_seconds=CACHE_TIMES['CURRENT_PRICES']
        )
        
    except Exception as e:
        print(f"Supabase error: {e}")
        raise HTTPException(status_code=500, detail="데이터베이스 연결 오류가 발생했습니다")

@app.get("/materials/current-all")
async def get_current_materials():
    """현재 자재 가격 조회"""
    try:
        materials = await supabase_service.get_all_materials()
        return {"materials": materials}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/materials/by-category")
async def get_materials_by_category(
    level1_category: str = None,
    level2_category: str = None,
    level3_category: str = None
):
    """카테고리별 자재 조회"""
    try:
        materials = await supabase_service.get_materials_by_category(
            level1_category=level1_category,
            level2_category=level2_category,
            level3_category=level3_category
        )
        return {"materials": materials}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/materials/history/{material}")
async def get_materialprice_kpi(
    material: str, 
    period: str = "30d",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """자재별 가격 이력 조회 (KPI 사이트 기반)"""
    try:
        # 기간 파라미터 처리
        if start_date and end_date:
            # 명시적 날짜 범위가 주어진 경우
            pass
        else:
            # period 파라미터로 날짜 범위 계산
            end_date = datetime.now().strftime("%Y-%m-%d")
            
            if period == "7d":
                start_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
            elif period == "30d":
                start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            elif period == "90d":
                start_date = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
            elif period == "1y":
                start_date = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
            else:
                start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        # KPI 자재 가격 이력 조회 (새로운 메서드 사용)
        price_history = await supabase_service.get_kpi_material_prices(
            material, period, start_date, end_date
        )
        
        return {
            "material": material,
            "period": period,
            "start_date": start_date,
            "end_date": end_date,
            "data": price_history
        }
        
    except Exception as e:
        logger.error(f"Failed to get material price history for {material}: {e}")
        raise HTTPException(status_code=500, detail=f"자재 가격 이력 조회 실패: {str(e)}")

@app.get("/materials/compare")
async def compare_materials(materials: str = "SUS304,SUS316,SS275", period: str = "30d"):
    """여러 자재 가격 비교"""
    material_list = materials.split(",")
    comparison_data = {}
    
    for material in material_list:
        # Supabase에서 데이터 조회
        try:
            db_data = await supabase_service.get_materialprice_kpi(material, period)
            if db_data:
                comparison_data[material] = db_data
            else:
                print(f"No data found for {material}")
        except Exception as e:
            print(f"Supabase error for {material}: {e}")
    
    if not comparison_data:
        raise HTTPException(status_code=404, detail="요청한 자재들의 데이터를 찾을 수 없습니다")
    
    return {"materials": materials, "period": period, "data": comparison_data}

# 중복 엔드포인트 제거됨 - 아래의 더 완전한 버전 사용

# 계산기 엔드포인트
@app.post("/calculate/tank-volume")
async def calculate_tank_volume(calc: TankCalculation):
    """Tank 부피 계산"""
    try:
        volume = math.pi * (calc.diameter / 2) ** 2 * calc.height
        return {
            "volume": round(volume, 4),
            "unit": "m³",
            "formula": "V = π × (D/2)² × H",
            "inputs": {"diameter": calc.diameter, "height": calc.height}
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/calculate/npsh")
async def calculate_npsh(calc: NPSHCalculation):
    """NPSH 계산"""
    try:
        # NPSH = ((Pa - Pv) × 10.2) + Hs - Hf
        npsh = ((calc.atmospheric_pressure - calc.vapor_pressure) * 10.2) + calc.static_head - calc.friction_loss
        return {
            "npsh": round(npsh, 4),
            "unit": "m",
            "formula": "NPSH = ((Pa - Pv) × 10.2) + Hs - Hf",
            "inputs": {
                "atmospheric_pressure": calc.atmospheric_pressure,
                "vapor_pressure": calc.vapor_pressure,
                "static_head": calc.static_head,
                "friction_loss": calc.friction_loss
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/calculate/affinity")
async def calculate_affinity(calc: AffinityCalculation):
    """상사법칙 계산"""
    try:
        # 상사법칙 공식
        # Q2/Q1 = N2/N1
        # H2/H1 = (N2/N1)²
        # P2/P1 = (N2/N1)³
        
        ratio = calc.n2 / calc.n1
        q2 = calc.q1 * ratio
        h2 = calc.h1 * (ratio ** 2)
        p2 = calc.p1 * (ratio ** 3)
        
        return {
            "results": {
                "flow_rate": round(q2, 4),
                "head": round(h2, 4),
                "power": round(p2, 4)
            },
            "units": {
                "flow_rate": "m³/h",
                "head": "m",
                "power": "kW"
            },
            "formulas": {
                "flow_rate": "Q2 = Q1 × (N2/N1)",
                "head": "H2 = H1 × (N2/N1)²",
                "power": "P2 = P1 × (N2/N1)³"
            },
            "inputs": {
                "n1": calc.n1,
                "n2": calc.n2,
                "q1": calc.q1,
                "h1": calc.h1,
                "p1": calc.p1
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/health")
async def health_check():
    """헬스 체크"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# 크롤링 관련 엔드포인트는 제거됨 (별도 크롤러 스크립트 사용)

@app.get("/materials/categories")
async def get_material_categories():
    """자재 카테고리 목록 조회 (15개 대분류 포함)"""
    try:
        categories = await supabase_service.get_all_categories()
        return {"categories": categories}
    except Exception as e:
        logger.error(f"Failed to get material categories: {e}")
        raise HTTPException(status_code=500, detail=f"카테고리 조회 실패: {str(e)}")

@app.get("/materials/categories/hierarchy")
async def get_category_hierarchy():
    """전체 카테고리 계층 구조 조회"""
    try:
        hierarchy = await supabase_service.get_category_hierarchy()
        return {"hierarchy": hierarchy}
    except Exception as e:
        logger.error(f"Failed to get category hierarchy: {e}")
        raise HTTPException(status_code=500, detail=f"카테고리 계층 조회 실패: {str(e)}")

@app.get("/materials/by-category/{level1}")
async def get_materials_by_level1(level1: str):
    """대분류별 자재 목록 조회"""
    try:
        materials = await supabase_service.get_materials_by_level1(level1)
        return {
            "level1": level1,
            "materials": materials,
            "count": len(materials)
        }
    except Exception as e:
        logger.error(f"Failed to get materials for level1 {level1}: {e}")
        raise HTTPException(status_code=500, detail=f"대분류별 자재 조회 실패: {str(e)}")

@app.get("/materials/by-category/{level1}/{level2}")
async def get_materials_by_level2(level1: str, level2: str):
    """중분류별 자재 목록 조회"""
    try:
        materials = await supabase_service.get_materials_by_level2(level1, level2)
        return {
            "level1": level1,
            "level2": level2,
            "materials": materials,
            "count": len(materials)
        }
    except Exception as e:
        logger.error(f"Failed to get materials for level2 {level1}/{level2}: {e}")
        raise HTTPException(status_code=500, detail=f"중분류별 자재 조회 실패: {str(e)}")

@app.get("/materials/by-category/{level1}/{level2}/{level3}")
async def get_materials_by_level3(level1: str, level2: str, level3: str):
    """소분류별 자재 목록 조회"""
    try:
        materials = await supabase_service.get_materials_by_level3(level1, level2, level3)
        return {
            "level1": level1,
            "level2": level2,
            "level3": level3,
            "materials": materials,
            "count": len(materials)
        }
    except Exception as e:
        logger.error(f"Failed to get materials for level3 {level1}/{level2}/{level3}: {e}")
        raise HTTPException(status_code=500, detail=f"소분류별 자재 조회 실패: {str(e)}")

@app.get("/materials/by-category/{level1}/{level2}/{level3}/{level4}")
async def get_materials_by_level4(level1: str, level2: str, level3: str, level4: str):
    """세분류별 자재 목록 조회"""
    try:
        materials = await supabase_service.get_materials_by_level4(level1, level2, level3, level4)
        return {
            "level1": level1,
            "level2": level2,
            "level3": level3,
            "level4": level4,
            "materials": materials,
            "count": len(materials)
        }
    except Exception as e:
        logger.error(f"Failed to get materials for level4 {level1}/{level2}/{level3}/{level4}: {e}")
        raise HTTPException(status_code=500, detail=f"세분류별 자재 조회 실패: {str(e)}")

@app.get("/materials/prices/date-range")
async def get_materials_by_date_range(start_date: str, end_date: str, materials: Optional[str] = None):
    """날짜 범위별 자재 가격 조회"""
    try:
        # 날짜 형식 검증
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        
        # 자재 목록 파싱 및 URL 디코딩
        import urllib.parse
        if materials:
            # URL 디코딩 후 분리 (이중 디코딩 시도)
            decoded_materials = urllib.parse.unquote_plus(materials)
            logger.info(f"1차 디코딩 결과: {decoded_materials}")
            
            # 필요시 추가 디코딩
            if '%' in decoded_materials:
                decoded_materials = urllib.parse.unquote_plus(decoded_materials)
                logger.info(f"2차 디코딩 결과: {decoded_materials}")
            
            # 유니코드 정규화 (NFC 형식으로 통일)
            decoded_materials = unicodedata.normalize('NFC', decoded_materials)
            
            # 자재명에 쉼표가 포함될 수 있으므로 단순 split 대신 더 정교한 파싱 필요
            # 현재는 단일 자재만 처리 (여러 자재는 추후 구현)
            material_list = [unicodedata.normalize('NFC', decoded_materials.strip())]
            logger.info(f"최종 자재 목록: {material_list}")
        else:
            material_list = ["SUS304", "SS275", "AL6061"]
        
        # Supabase에서 데이터 조회
        db_data = await supabase_service.get_materials_by_date_range(start_date, end_date, material_list)
        if db_data:
            return {"data": db_data, "period": f"{start_date} ~ {end_date}"}
        else:
            raise HTTPException(status_code=404, detail="요청한 기간의 데이터를 찾을 수 없습니다")
    except ValueError as e:
        logger.error(f"날짜 형식 오류: {e}")
        raise HTTPException(status_code=400, detail="날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식을 사용하세요.")
    except Exception as e:
        logger.error(f"데이터 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"데이터 조회 실패: {str(e)}")

# 크롤링 스케줄러 관련 API는 제거됨 (별도 크롤러 스크립트 사용)

@app.get("/materials/list")
async def get_materials(
    level1: str = None,
    level2: str = None,
    level3: str = None,
    level4: str = None
):
    """계층별 자재 목록 조회"""
    try:
        logger.info(f"Getting materials for level1={level1}, level2={level2}, level3={level3}, level4={level4}")
        
        # KPI 자재 목록 조회 (major/middle/minor 카테고리 사용)
        materials = await supabase_service.get_kpi_materials_by_category(
            major_category=level1, 
            middle_category=level2, 
            minor_category=level3
        )
        
        # material_name + specification 조합으로 고유 키 생성 및 중복 제거
        seen_combinations = set()
        unique_materials = []
        for material in materials:
            material_name = material.get('material_name', '')
            specification = material.get('specification', '') or ''
            
            # specification이 없거나 비어있으면 material_name에서 추출 시도
            if not specification:
                # material_name에서 괄호 안의 내용을 specification으로 추출
                import re
                # 예: "고장력철근(하이바)(SD 400)" -> "하이바, SD 400"
                matches = re.findall(r'\(([^)]+)\)', material_name)
                if matches:
                    specification = ', '.join(matches)
                    display_specification = specification
                else:
                    display_specification = None
            else:
                display_specification = specification
            
            # specification이 material_name과 같거나 비어있으면 material_name만 사용
            if not specification or specification == material_name:
                unique_key = material_name
                unique_id = material_name
            else:
                # specification이 다르면 조합하여 고유 키 생성
                unique_key = f"{material_name}__{specification}"
                unique_id = f"{material_name}_{specification}"
            
            if unique_key not in seen_combinations:
                seen_combinations.add(unique_key)
                # 프론트엔드에서 사용할 고유 식별자와 specification 정보 추가
                material['unique_id'] = unique_id
                material['display_specification'] = display_specification
                # 원본 specification 업데이트
                material['specification'] = specification if specification else None
                unique_materials.append(material)
        
        return {
            "status": "success",
            "materials": unique_materials
        }
    except Exception as e:
        logger.error(f"Failed to get materials: {e}")
        raise HTTPException(status_code=500, detail="자재 목록 조회 실패")

@app.get("/materials/supabase")
async def get_supabase_materials():
    """Supabase에서 모든 자재 데이터 조회"""
    try:
        materials = await supabase_service.get_all_materials()
        # 응답 보정: 누락된 가격 필드를 안전하게 채워 프론트에서 0원 표기가
        # 발생하지 않도록 처리
        normalized = []
        for item in materials or []:
            # 딕셔너리 복사 후 키 보정
            m = dict(item)
            # 숫자 변환 유틸
            def to_float(v):
                try:
                    return float(v)
                except Exception:
                    return 0.0
            # current / previous 보정
            if 'current_price' not in m:
                m['current_price'] = to_float(m.get('price', 0))
            else:
                m['current_price'] = to_float(m.get('current_price'))
            if 'previous_price' not in m:
                # 이전값이 없으면 현재값으로 세팅
                m['previous_price'] = m['current_price']
            else:
                m['previous_price'] = to_float(m.get('previous_price'))
            # price 동기화
            if 'price' not in m:
                m['price'] = m['current_price']
            else:
                m['price'] = to_float(m.get('price'))
            normalized.append(m)
        return normalized
    except Exception as e:
        print(f"Supabase materials error: {e}")
        raise HTTPException(status_code=500, detail=f"자재 데이터 조회 실패: {str(e)}")

@app.get("/materials/chart-data")
async def get_chart_data(
    materials: str,
    interval: str = "monthly",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """차트용 자재 가격 데이터 조회 (주간/월간/연간 평균 집계)"""
    try:
        # 자재 목록 파싱
        material_list = [m.strip() for m in materials.split(",")]
        
        # interval 값 검증 및 변환
        valid_intervals = ["weekly", "monthly", "yearly"]
        if interval not in valid_intervals:
            interval = "monthly"  # 기본값
        
        # 날짜 범위가 지정되지 않은 경우 실제 데이터 범위 조회
        if not start_date or not end_date:
            date_range = await supabase_service.get_data_date_range(material_list)
            if not start_date:
                start_date = date_range.get('min_date', '2022-01-01')
            if not end_date:
                end_date = date_range.get('max_date', datetime.now().strftime("%Y-%m-%d"))
        
        # Supabase에서 데이터 조회 및 집계
        chart_data = await supabase_service.get_aggregated_price_data(
            material_list, interval, start_date, end_date
        )
        
        return {
            "materials": material_list,
            "interval": interval,
            "start_date": start_date,
            "end_date": end_date,
            "data": chart_data
        }
    except Exception as e:
        logger.error(f"Chart data error: {e}")
        raise HTTPException(status_code=500, detail=f"차트 데이터 조회 실패: {str(e)}")

@app.get("/materials/chart-data-by-category")
async def get_chart_data_by_category(
    level4_category: str,
    interval: str = "monthly",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """세분류(level4) 카테고리별 차트 데이터 조회 - 첫 번째 규격 기준"""
    try:
        # 날짜 범위 설정
        if not start_date or not end_date:
            if not start_date:
                start_date = '2022-01-01'
            if not end_date:
                end_date = datetime.now().strftime("%Y-%m-%d")
        
        # Supabase에서 세분류별 차트 데이터 조회
        chart_data = await supabase_service.get_chart_data_by_level4(
            level4_category, interval, start_date, end_date
        )
        
        return {
            "level4_category": level4_category,
            "interval": interval,
            "start_date": start_date,
            "end_date": end_date,
            "data": chart_data
        }
    except Exception as e:
        logger.error(f"Chart data by category error: {e}")
        raise HTTPException(status_code=500, detail=f"카테고리별 차트 데이터 조회 실패: {str(e)}")

@app.get("/materials/dashboard-summary")
async def get_dashboard_summary():
    """대시보드 요약 정보 조회 (캐시 적용) - 최적화된 버전"""
    try:
        # 캐시 키 생성
        cache_key = cache_service._generate_key("dashboard_summary")
        
        # 캐시에서 조회하거나 새로 가져오기
        async def fetch_dashboard_summary():
            # 단일 쿼리로 통계 정보 조회
            response = supabase.table("materialprice_kpi").select(
                "level1_category, level2_category, level3_category, level4_category, material_name, price"
            ).execute()
            
            if not response.data:
                return {
                    "total_categories": 0,
                    "total_materials": 0,
                    "average_price": 0
                }
            
            # 카테고리와 자재 통계 계산
            categories = set()
            materials = set()
            prices = []
            
            for item in response.data:
                # 카테고리 수 계산 (level4까지 있는 것만)
                if item.get('level4_category'):
                    categories.add((
                        item.get('level1_category', ''),
                        item.get('level2_category', ''),
                        item.get('level3_category', ''),
                        item.get('level4_category', '')
                    ))
                
                # 자재명 수집
                if item.get('material_name'):
                    materials.add(item['material_name'])
                
                # 가격 수집 (유효한 가격만)
                price = item.get('price')
                if price is not None:
                    try:
                        price_float = float(str(price).replace(',', ''))
                        if price_float > 0:
                            prices.append(price_float)
                    except (ValueError, TypeError):
                        pass
            
            # 평균 가격 계산
            avg_price = sum(prices) / len(prices) if prices else 0
            
            return {
                "total_categories": len(categories),
                "total_materials": len(materials),
                "average_price": round(avg_price, 2)
            }
        
        return await cache_service.get_or_set(
            cache_key, 
            fetch_dashboard_summary, 
            expire_seconds=CACHE_TIMES['DASHBOARD_SUMMARY']
        )
        
    except Exception as e:
        logger.error(f"Failed to get dashboard summary: {e}")
        raise HTTPException(status_code=500, detail="대시보드 요약 정보 조회 실패")

@app.get("/materials/top-materials")
async def get_top_materials():
    """상위 자재 목록 조회 (데이터 수 기준)"""
    try:
        top_materials = await supabase_service.get_top_materials_by_count(20)
        return {
            "materials": top_materials,
            "total_count": len(top_materials)
        }
    except Exception as e:
        logger.error(f"Failed to get top materials: {e}")
        raise HTTPException(status_code=500, detail="상위 자재 목록 조회 실패")

@app.get("/materials/category-summary")
async def get_category_summary():
    """카테고리별 요약 정보 조회"""
    try:
        summary = await supabase_service.get_category_summary()
        return summary
    except Exception as e:
        logger.error(f"Failed to get category summary: {e}")
        raise HTTPException(status_code=500, detail="카테고리 요약 정보 조회 실패")

@app.get("/materials/specifications/{material_name}")
async def get_material_specifications(material_name: str):
    """특정 자재의 규격 목록 조회"""
    try:
        specifications = await supabase_service.get_material_specifications(material_name)
        return {
            "material_name": material_name,
            "specifications": specifications
        }
    except Exception as e:
        logger.error(f"Failed to get specifications for {material_name}: {e}")
        raise HTTPException(status_code=500, detail="자재 규격 조회 실패")

@app.get("/materials/unique")
async def get_unique_materials():
    """모든 고유 자재명 조회"""
    try:
        materials = await supabase_service.get_unique_materials()
        return {
            "materials": materials,
            "total_count": len(materials)
        }
    except Exception as e:
        logger.error(f"Failed to get unique materials: {e}")
        raise HTTPException(status_code=500, detail="고유 자재 목록 조회 실패")

# 계층적 카테고리 API
@app.get("/materials/hierarchy/level1")
async def get_level1_categories():
    """대분류 카테고리 목록 조회"""
    try:
        logger.info("Getting level1 categories from materialprice_kpi table")
        
        # Supabase에서 직접 level1_category 조회
        response = supabase.table('materialprice_kpi') \
            .select('level1_category') \
            .not_.is_('level1_category', 'null') \
            .execute()
        
        # 중복 제거하고 정렬
        categories = list(set([item['level1_category'] for item in response.data]))
        categories.sort()
        
        logger.info(f"Found level1 categories: {categories}")
        return {
            "status": "success",
            "categories": categories
        }
    except Exception as e:
        logger.error(f"Failed to get level1 categories: {e}")
        raise HTTPException(status_code=500, detail="대분류 목록 조회 실패")

@app.get("/materials/hierarchy/level2/{level1}")
async def get_level2_categories(level1: str):
    """중분류 카테고리 목록 조회"""
    try:
        logger.info(f"Getting level2 categories for level1: {level1}")
        
        # Supabase에서 직접 level2_category 조회 (null이 아닌 값과 빈 문자열이 아닌 값만 조회)
        response = supabase.table('materialprice_kpi') \
            .select('level2_category') \
            .eq('level1_category', level1) \
            .execute()
        
        # 중복 제거하고 정렬 (null이나 빈 문자열 제외)
        categories = list(set([item['level2_category'] for item in response.data if item['level2_category'] and item['level2_category'].strip()]))
        categories.sort()
        
        logger.info(f"Filtered level2 categories (removed null/empty): {categories}")
        
        logger.info(f"Found level2 categories for {level1}: {categories}")
        return {
            "status": "success",
            "categories": categories
        }
    except Exception as e:
        logger.error(f"Failed to get level2 categories: {e}")
        raise HTTPException(status_code=500, detail="중분류 카테고리 조회 실패")

@app.get("/materials/hierarchy/level3/{level1}/{level2}")
async def get_level3_categories(level1: str, level2: str):
    """소분류 카테고리 목록 조회"""
    try:
        logger.info(f"Getting level3 categories for level1: {level1}, level2: {level2}")
        
        # Supabase에서 직접 level3_category 조회 (null이 아닌 값만 조회)
        response = supabase.table('materialprice_kpi') \
            .select('level3_category') \
            .eq('level1_category', level1) \
            .eq('level2_category', level2) \
            .execute()
        
        # 중복 제거하고 정렬 (null이나 빈 문자열 제외)
        categories = list(set([item['level3_category'] for item in response.data if item['level3_category'] and item['level3_category'].strip()]))
        categories.sort()
        
        logger.info(f"Filtered level3 categories (removed null/empty): {categories}")
        
        logger.info(f"Found level3 categories for {level1}/{level2}: {categories}")
        return {
            "status": "success",
            "categories": categories
        }
    except Exception as e:
        logger.error(f"Failed to get level3 categories: {e}")
        raise HTTPException(status_code=500, detail="소분류 카테고리 조회 실패")

@app.get("/materials/hierarchy/level4/{level1}/{level2}/{level3}")
async def get_level4_categories(level1: str, level2: str, level3: str):
    """세분류 목록 조회"""
    try:
        logger.info(f"Getting level4 categories for {level1}/{level2}/{level3}")
        
        # Supabase에서 직접 level4_category 조회 (null이 아닌 값만 조회)
        response = supabase.table('materialprice_kpi') \
            .select('level4_category') \
            .eq('level1_category', level1) \
            .eq('level2_category', level2) \
            .eq('level3_category', level3) \
            .execute()
        
        # 중복 제거하고 정렬 (null이나 빈 문자열 제외)
        categories = list(set([item['level4_category'] for item in response.data if item['level4_category'] and item['level4_category'].strip()]))
        categories.sort()
        
        logger.info(f"Filtered level4 categories (removed null/empty): {categories}")
        
        logger.info(f"Found level4 categories for {level1}/{level2}/{level3}: {categories}")
        return {
            "status": "success",
            "categories": categories
        }
    except Exception as e:
        logger.error(f"Failed to get level4 categories for {level1}/{level2}/{level3}: {e}")
        raise HTTPException(status_code=500, detail="세분류 목록 조회 실패")

# KPI 사이트 구조 기반 새로운 엔드포인트
@app.get("/materials/kpi-categories")
async def get_kpi_categories():
    """KPI 사이트의 17개 level1 카테고리 조회"""
    try:
        categories = await supabase_service.get_kpi_level1_categories()
        return {
            "status": "success",
            "data": categories
        }
    except Exception as e:
        logger.error(f"KPI level1 카테고리 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/materials/kpi-categories/{level1_code}")
async def get_kpi_level2_categories(level1_code: str):
    """KPI 사이트의 level2 카테고리 조회"""
    try:
        categories = await supabase_service.get_kpi_level2_categories(level1_code)
        return {
            "status": "success",
            "data": categories
        }
    except Exception as e:
        logger.error(f"KPI level2 카테고리 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/materials/kpi-categories/{level1_code}/{level2_code}")
async def get_kpi_level3_categories(level1_code: str, level2_code: str):
    """KPI 사이트의 level3 카테고리 조회"""
    try:
        categories = await supabase_service.get_kpi_level3_categories(level1_code, level2_code)
        return {
            "status": "success",
            "data": categories
        }
    except Exception as e:
        logger.error(f"KPI level3 카테고리 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/materials/kpi-categories/{level1_code}/{level2_code}/{level3_code}")
async def get_kpi_level4_categories(level1_code: str, level2_code: str, level3_code: str):
    """KPI 사이트의 level4 카테고리 조회"""
    try:
        categories = await supabase_service.get_kpi_level4_categories(level1_code, level2_code, level3_code)
        return {
            "status": "success",
            "data": categories
        }
    except Exception as e:
        logger.error(f"KPI level4 카테고리 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/materials/kpi-materials/{category_code}")
async def get_kpi_materials_by_category(category_code: str):
    """KPI 카테고리별 자재 목록 조회"""
    try:
        materials = await supabase_service.get_kpi_materials_by_category(category_code)
        return {
            "status": "success",
            "data": materials
        }
    except Exception as e:
        logger.error(f"KPI 카테고리별 자재 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/materials/kpi-prices/{material_name}")
async def get_kpi_material_prices(material_name: str, period: str = "30d"):
    """KPI 자재 가격 이력 조회"""
    try:
        data = await supabase_service.get_kpi_material_prices(material_name, period)
        return {
            "success": True,
            "data": data
        }
    except Exception as e:
        logger.error(f"KPI 자재 가격 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/materials/analysis/category-structure")
async def analyze_category_structure():
    """자재 카테고리 구조 분석 - level1~4 매칭 상태 확인"""
    try:
        # 전체 자재 수 조회
        total_count = await supabase_service.get_total_materials_count()
        
        # level별 분포 조회
        level_stats = await supabase_service.get_category_level_stats()
        
        # level4가 없는 자재들 조회 (샘플)
        missing_level4 = await supabase_service.get_materials_missing_level4(limit=50)
        
        # level1별 통계
        level1_stats = await supabase_service.get_level1_category_stats()
        
        return {
            "success": True,
            "analysis": {
                "total_materials": total_count,
                "level_distribution": level_stats,
                "level1_breakdown": level1_stats,
                "missing_level4_samples": missing_level4,
                "completion_rate": {
                    "level1": (level_stats.get('level1_count', 0) / total_count * 100) if total_count > 0 else 0,
                    "level2": (level_stats.get('level2_count', 0) / total_count * 100) if total_count > 0 else 0,
                    "level3": (level_stats.get('level3_count', 0) / total_count * 100) if total_count > 0 else 0,
                    "level4": (level_stats.get('level4_count', 0) / total_count * 100) if total_count > 0 else 0
                }
            }
        }
    except Exception as e:
        logger.error(f"카테고리 구조 분석 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/materials/fix-missing-level4")
async def fix_missing_level4_categories():
    """level4가 없는 자재들의 카테고리 재파싱 및 업데이트"""
    try:
        from enhanced_kpi_crawler import AdvancedKPICrawler
        
        # level4가 없는 모든 자재 조회
        missing_materials = await supabase_service.get_materials_missing_level4(limit=1000)
        
        crawler = AdvancedKPICrawler()
        updated_count = 0
        
        for material in missing_materials:
            material_name = material.get('material_name')
            specification = material.get('specification', '')
            
            # 카테고리 재파싱
            category_info = crawler.parse_category_hierarchy(material_name, specification)
            
            if category_info.get('level4_category'):
                # 데이터베이스 업데이트
                try:
                    response = supabase_service.supabase.table("materialprice_kpi").update({
                        "level4_category": category_info['level4_category'],
                        "grade": category_info.get('grade'),
                        "size_spec": category_info.get('size_spec')
                    }).eq("material_name", material_name).eq("specification", specification).execute()
                    
                    if response.data:
                        updated_count += len(response.data)
                        
                except Exception as update_error:
                    logger.error(f"자재 업데이트 실패 {material_name}: {update_error}")
        
        return {
            "success": True,
            "message": f"{updated_count}개 자재의 level4 카테고리가 업데이트되었습니다.",
            "updated_count": updated_count
        }
        
    except Exception as e:
        logger.error(f"level4 카테고리 수정 중 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 크롤링 히스토리 관련 API는 제거됨 (별도 크롤러 스크립트 사용)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)