# -*- coding: utf-8 -*-

import os
import asyncio
import sys
import re
import psutil
from datetime import datetime
from dotenv import load_dotenv
from playwright.async_api import async_playwright, TimeoutError
from upstash_redis import AsyncRedis
from jsonc_parser import parse_jsonc

# 절대 import를 위한 경로 설정
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# --- 1. 초기 설정 및 환경변수 로드 ---
load_dotenv("../../.env.local")

# data_processor 모듈에서 필요한 함수와 객체를 import
from data_processor import log, create_data_processor, api_monitor as supabase

# --- 2. 크롤링 대상 카테고리 및 단위 설정 ---
INCLUSION_LIST_PATH = os.path.join(current_dir, "kpi_inclusion_list_compact.jsonc")
with open(INCLUSION_LIST_PATH, "r", encoding="utf-8") as f:
    jsonc_content = f.read()
INCLUSION_LIST = parse_jsonc(jsonc_content)


# --- 3. Playwright 웹 크롤러 클래스 ---
class KpiCrawler:
    def __init__(self, target_major: str = None, target_middle: str = None,
                 target_sub: str = None, crawl_mode: str = "all",
                 start_year: str = '2020', start_month: str = '01', max_concurrent=3):
        self.base_url = "https://www.kpi.or.kr"
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.supabase = supabase

        self.target_major_category = target_major
        self.target_middle_category = target_middle
        self.target_sub_category = target_sub
        self.crawl_mode = crawl_mode
        self.start_year = start_year
        self.start_month = start_month

        self.processor = create_data_processor('kpi')

        self.base_regions = [
            '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원',
            '충북', '충남', '전북', '전남', '경북', '경남', '제주', '수원', '성남', '춘천',
            '청주', '전주', '포항', '창원', '김해', '구미', '천안', '진주', '원주', '경주',
            '충주', '여수', '목포'
        ]

        # Redis 클라이언트 초기화
        try:
            if 'UPSTASH_REDIS_REST_URL' in os.environ and 'UPSTASH_REDIS_REST_TOKEN' in os.environ:
                self.redis = AsyncRedis.from_env()
                log("✅ Upstash Redis REST API 클라이언트 초기화 성공")
            else:
                self.redis = None
                log("⚠️ Redis 환경 변수가 설정되지 않았습니다. 캐시 기능이 비활성화됩니다.", "WARNING")
        except Exception as e:
            self.redis = None
            log(f"⚠️ Redis 초기화 실패: {str(e)}. 캐시 기능이 비활성화됩니다.", "WARNING")

        log(f"크롤러 초기화 - 모드: {self.crawl_mode}, 타겟: {self.target_major_category or '전체'}")

    async def run(self):
        """크롤링 프로세스 실행"""
        browser = None
        try:
            async with async_playwright() as p:
                # 가짜 User-Agent 설정 및 브라우저 실행
                browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-setuid-sandbox'])
                self.context = await browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
                self.page = await self.context.new_page()

                # 속도 최적화: 불필요한 리소스 로딩 차단
                await self.page.route("**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2,pdf}", lambda route: route.abort())

                await self._login()
                await self._navigate_to_category()
                await self._crawl_categories()

                log("\n🟢 === 전체 크롤링 완료 === 🟢\n", "SUMMARY")
                await browser.close()
                return self.processor
        except Exception as e:
            log(f"크롤링 실행 중 최상위 오류 발생: {str(e)}", "ERROR")
            if browser:
                try: await browser.close()
                except: pass
            raise

    async def _login(self):
        """로그인 수행 (안정화 버전)"""
        log("로그인 페이지로 이동 중...")
        # networkidle 대신 domcontentloaded 사용
        await self.page.goto(f"{self.base_url}/www/member/login.asp", timeout=90000, wait_until="domcontentloaded")
        
        username = os.environ.get("KPI_USERNAME")
        password = os.environ.get("KPI_PASSWORD")

        if not username or not password:
            raise ValueError("KPI_USERNAME, KPI_PASSWORD 환경 변수를 설정해야 합니다.")

        await self.page.locator("#user_id").fill(username)
        await self.page.locator("#user_pw").fill(password)
        
        # 클릭과 페이지 이동을 동시에 기다림
        await asyncio.gather(
            self.page.wait_for_load_state("domcontentloaded", timeout=60000),
            self.page.locator("#sendLogin").click()
        )

        # 로그인 후 메인이나 특정 요소가 나타나는지 확인 (로그인 성공 확인)
        try:
            await self.page.wait_for_selector("a[href*='logout'], .login-info", timeout=30000)
            log("로그인 성공", "SUCCESS")
        except:
            if "login.asp" in self.page.url:
                 raise ValueError("로그인 실패: KPI 웹사이트 로그인 정보를 확인하세요.")
            log("로그인 성공 여부 확인이 불분명하지만 계속 진행합니다.", "WARNING")

    async def _navigate_to_category(self):
        """카테고리 페이지로 이동 및 팝업 처리"""
        log("종합물가정보 페이지로 이동 중...")
        # networkidle은 외부 스크립트 때문에 무한 대기할 수 있으므로 domcontentloaded 후 셀렉터 대기 방식 사용
        await self.page.goto(f"{self.base_url}/www/price/category.asp", timeout=90000, wait_until="domcontentloaded")
        
        try:
            # 카테고리 메뉴가 보일 때까지 대기
            await self.page.wait_for_selector("#left_menu_kpi", timeout=60000)
        except Exception as e:
            log(f"카테고리 메뉴 로딩 지연: {str(e)}", "WARNING")
        
        # 팝업 닫기
        try:
            popups = await self.page.query_selector_all(".pop-btn-close")
            for popup_close in popups:
                if await popup_close.is_visible():
                    await popup_close.click(timeout=5000)
                    log("팝업 닫기 성공")
        except Exception:
            pass
        
        log("카테고리 페이지 이동 완료", "SUCCESS")

    async def _crawl_categories(self):
        """대분류 -> 중분류 -> 소분류 순차적으로 크롤링"""
        major_selector = '#left_menu_kpi > ul.panel > li.file-item > a'
        # 요소가 로드될 때까지 대기
        await self.page.wait_for_selector(major_selector, timeout=30000)
        major_categories_elements = await self.page.locator(major_selector).all()

        major_links = []
        for cat in major_categories_elements:
            name = (await cat.inner_text()).strip()
            href = await cat.get_attribute('href')
            if name in INCLUSION_LIST:
                major_links.append({'name': name, 'href': href})

        for major in major_links:
            if self.target_major_category and major['name'] != self.target_major_category:
                continue

            log(f"대분류 '{major['name']}' 크롤링 시작...")
            await self.page.goto(f"{self.base_url}{major['href']}", wait_until="domcontentloaded", timeout=60000)
            
            # 우측 퀵메뉴 닫기 (방해 요소 제거)
            try:
                close_button = self.page.locator("#right_quick .q_cl")
                if await close_button.is_visible(timeout=5000):
                    await close_button.click()
                    log("  'Right Quick' 메뉴를 숨겼습니다.")
            except Exception:
                pass

            # 모든 분류 펼치기
            open_sub_button = self.page.locator('a[href="javascript:openSub();"]')
            if await open_sub_button.count() > 0:
                log("  openSub() 버튼 클릭하여 모든 분류 펼치는 중...")
                await open_sub_button.click()
                await self.page.wait_for_timeout(3000)

            # 중분류 요소 로드 대기
            await self.page.wait_for_selector('.part-open-list', timeout=30000)
            all_middle_elements = await self.page.locator('.part-open-list').all()
            
            for middle_element in all_middle_elements:
                try:
                    middle_link_element = middle_element.locator('.part-ttl > a').first
                    middle_name = (await middle_link_element.inner_text()).strip()

                    if middle_name not in INCLUSION_LIST.get(major['name'], {}):
                        continue
                    
                    if self.target_middle_category and middle_name != self.target_middle_category:
                        continue
                    
                    log(f"  중분류 '{middle_name}' 처리 시작...")

                    sub_links_elements = await middle_element.locator('.part-list li a').all()
                    sub_links_to_crawl = []
                    
                    for sub_link_element in sub_links_elements:
                        sub_name = (await sub_link_element.inner_text()).strip()
                        
                        if sub_name in INCLUSION_LIST.get(major['name'], {}).get(middle_name, {}):
                            if self.target_sub_category and sub_name != self.target_sub_category:
                                continue

                            href = await sub_link_element.get_attribute('href')
                            sub_links_to_crawl.append({'name': sub_name, 'href': href})

                    if sub_links_to_crawl:
                        await self._crawl_subcategories_parallel(major['name'], middle_name, sub_links_to_crawl)
                    else:
                        log(f"    중분류 '{middle_name}': INCLUSION_LIST에 포함된 처리할 소분류가 없습니다.")

                except Exception as e:
                    log(f"  중분류 처리 중 오류 발생: {e}", "ERROR")
                    continue
            
            log(f"[캐시 무효화] 대분류 '{major['name']}' 크롤링 완료 후 관련 캐시를 무효화합니다.")
            await self.clear_redis_cache(major_name=major['name'])

    async def _crawl_subcategories_parallel(self, major_name, middle_name, sub_categories_info):
        """소분류 병렬 크롤링 후 중분류 단위로 저장 및 캐시 무효화"""
        if not sub_categories_info:
            return

        log(f"    중분류 '{middle_name}': {len(sub_categories_info)}개 소분류를 병렬로 처리합니다.")

        tasks = [self._crawl_single_subcategory(major_name, middle_name, sub_info) for sub_info in sub_categories_info]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_data_for_middle_category = []
        for i, result in enumerate(results):
            sub_name = sub_categories_info[i]['name']
            if isinstance(result, Exception):
                log(f"    ❌ 소분류 '{sub_name}' 처리 중 심각한 오류: {result}", "ERROR")
            elif result:
                all_data_for_middle_category.extend(result)
        
        if all_data_for_middle_category:
            log(f"  [DB 저장] 중분류 '{middle_name}'의 전체 데이터 {len(all_data_for_middle_category)}개를 저장합니다.")
            saved_count = await self.processor.save_to_supabase(all_data_for_middle_category, 'kpi_price_data')
            if saved_count > 0:
                log(f"  [캐시 무효화] 중분류 '{middle_name}' 관련 캐시를 무효화합니다.")
                await self.clear_redis_cache(major_name=major_name, middle_name=middle_name)
        else:
            log(f"  중분류 '{middle_name}'에서 최종 저장할 데이터가 없습니다.")

    async def _crawl_single_subcategory(self, major_name, middle_name, sub_info):
        """단일 소분류의 모든 데이터를 수집하여 반환"""
        async with self.semaphore:
            sub_name = sub_info['name']
            sub_href = sub_info['href']
            sub_url = f"{self.base_url}/www/price/{sub_href}"

            log(f"    - '{sub_name}' 수집 시작")
            new_page = None
            max_retries = 3
            
            for attempt in range(max_retries):
                try:
                    new_page = await self.context.new_page()
                    # 새 페이지에도 리소스 차단 적용
                    await new_page.route("**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2}", lambda route: route.abort())
                    
                    await new_page.goto(sub_url, timeout=60000, wait_until="domcontentloaded")
                    
                    # '상세보기/추이' 버튼 대기 및 클릭
                    detail_btn_selector = 'a[href*="detail_change.asp"]'
                    await new_page.wait_for_selector(detail_btn_selector, timeout=30000)
                    await new_page.click(detail_btn_selector)
                    
                    # 규격 드롭다운 대기
                    spec_dropdown_selector = 'select#ITEM_SPEC_CD'
                    await new_page.wait_for_selector(spec_dropdown_selector, timeout=60000)

                    options = await new_page.locator(f'{spec_dropdown_selector} option').all()
                    specs_to_crawl = [{'name': (await o.inner_text()).strip(), 'value': await o.get_attribute('value')} for o in options if await o.get_attribute('value')]
                    
                    if not specs_to_crawl:
                        await new_page.close()
                        return []

                    all_crawled_data = []
                    for i, spec in enumerate(specs_to_crawl):
                        try:
                            # 페이지 안정화 대기
                            await new_page.wait_for_timeout(2000)
                            await new_page.select_option(spec_dropdown_selector, value=spec['value'], timeout=30000)

                            if i == 0:
                                # 시작 기간 설정
                                await new_page.select_option('select#DATA_YEAR_F', value=self.start_year)
                                await new_page.select_option('select#DATA_MONTH_F', value=self.start_month)
                                
                                # 종료 기간 설정 (최신 데이터까지)
                                end_year_selector = 'select#DATA_YEAR_T'
                                latest_year = await new_page.locator(f'{end_year_selector} option').first.get_attribute('value')
                                await new_page.select_option(end_year_selector, value=latest_year)
                                
                                end_month_selector = 'select#DATA_MONTH_T'
                                latest_month = await new_page.locator(f'{end_month_selector} option').last.get_attribute('value')
                                await new_page.select_option(end_month_selector, value=latest_month)
                            
                            # 조회 버튼 클릭 후 응답 대기
                            async with new_page.expect_response(lambda r: "detail_change.asp" in r.url, timeout=60000):
                                await new_page.click('form[name="sForm"] input[type="image"]')
                            
                            # 테이블 로드 대기
                            try:
                                await new_page.wait_for_selector('table#priceTrendDataArea tr:nth-child(2)', timeout=20000)
                            except Exception:
                                log(f"      - Spec '{spec['name'][:20]}...': 데이터 없음.", "INFO")
                                continue

                            unit = self._get_unit_from_inclusion_list(major_name, middle_name, sub_name, spec['name'])
                            headers = [th.strip() for th in await new_page.locator('table#priceTrendDataArea th').all_inner_texts()]
                            rows = await new_page.locator('table#priceTrendDataArea tr').all()

                            for row in rows[1:]:
                                cols_text = await row.locator('td').all_inner_texts()
                                if not cols_text: continue
                                
                                date = cols_text[0].strip()
                                prices_text = [p.strip().replace(',', '') for p in cols_text[1:]]
                                data_headers = headers[1:]
                                
                                has_region_header = any(self._is_region_header(h) for h in data_headers)

                                if has_region_header:
                                    first_region_header = next((h for h in data_headers if self._is_region_header(h)), None)
                                    if first_region_header:
                                        idx = data_headers.index(first_region_header)
                                        if idx < len(prices_text) and prices_text[idx].isdigit():
                                            region = self._remove_roman_numerals(first_region_header)
                                            all_crawled_data.append(self._create_data_entry(
                                                major_name, middle_name, sub_name, spec['name'],
                                                region, None, date, prices_text[idx], unit
                                            ))
                                else:
                                    for idx, header_text in enumerate(data_headers):
                                        if idx < len(prices_text) and prices_text[idx].isdigit():
                                            region = "전국"
                                            detail_spec = header_text
                                            all_crawled_data.append(self._create_data_entry(
                                                major_name, middle_name, sub_name, spec['name'],
                                                region, detail_spec, date, prices_text[idx], unit
                                            ))
                        except Exception as spec_e:
                            log(f"      - Spec '{spec.get('name', 'N/A')[:20]}...' 처리 중 오류: {spec_e}", "WARNING")
                            continue

                    await new_page.close()
                    log(f"    - '{sub_name}' 완료: {len(all_crawled_data)}개 데이터 수집.")
                    return all_crawled_data

                except Exception as e:
                    if new_page: await new_page.close()
                    if attempt == max_retries - 1:
                        log(f"    ❌ '{sub_name}' 최종 실패: {str(e)}", "ERROR")
                        return []
                    log(f"    ⚠️ '{sub_name}' 재시도 {attempt + 1}/{max_retries}: {str(e)}", "WARNING")
                    await asyncio.sleep(5)
        return []

    async def clear_redis_cache(self, major_name: str = None, middle_name: str = None):
        """AsyncRedis에 맞는 비동기 방식으로 캐시를 무효화"""
        if self.redis is None:
            return
            
        try:
            if major_name and middle_name:
                match_pattern = f"material_prices:{major_name}:{middle_name}:*"
            elif major_name:
                match_pattern = f"material_prices:{major_name}:*"
            else:
                match_pattern = "material_prices:*"

            cursor, keys = await self.redis.scan(0, match=match_pattern, count=500)
            keys_to_delete = keys
            
            while cursor != 0:
                cursor, keys = await self.redis.scan(cursor, match=match_pattern, count=500)
                keys_to_delete.extend(keys)

            if keys_to_delete:
                await self.redis.delete(*keys_to_delete)
                log(f"  ✅ Redis 캐시 무효화 성공: {len(keys_to_delete)}개 키 삭제")
                
            # 전체 크롤링 완료 시 대시보드 관련 캐시도 무효화
            if not major_name:
                for key in ['dashboard_summary_data', 'total_materials_count']:
                    try: await self.redis.delete(key)
                    except: pass
                
                # 집계 테이블 업데이트
                try:
                    from supabase import create_client
                    s_url, s_key = os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY')
                    if s_url and s_key:
                        client = create_client(s_url, s_key)
                        client.rpc('update_material_statistics').execute()
                        log(f"  ✅ 집계 테이블 업데이트 완료")
                except Exception as e:
                    log(f"  ❌ 집계 테이블 업데이트 실패: {str(e)}", "ERROR")
                        
        except Exception as e:
            log(f"  ❌ Redis 캐시 삭제 실패: {str(e)}", "ERROR")

    def _remove_roman_numerals(self, text):
        return re.sub(r'[①-⑩]', '', text)

    def _is_region_header(self, header_text):
        cleaned_header = self._remove_roman_numerals(header_text)
        return cleaned_header in self.base_regions

    def _create_data_entry(self, major, middle, sub, spec, region, detail_spec, date, price, unit):
        return {
            'major_category': major, 'middle_category': middle, 'sub_category': sub,
            'specification': spec,
            'region': region,
            'detail_spec': detail_spec,
            'date': f"{date.replace('.', '-')}-01",
            'price': int(price), 'unit': unit
        }

    def _get_unit_from_inclusion_list(self, major_name, middle_name, sub_name, spec_name=None):
        try:
            unit_data = INCLUSION_LIST.get(major_name, {}).get(middle_name, {}).get(sub_name)
            if isinstance(unit_data, dict):
                if spec_name and 'specifications' in unit_data:
                    specs = unit_data['specifications']
                    if spec_name in specs: return specs[spec_name]
                    for key, val in specs.items():
                        if spec_name in key or key in spec_name: return val
                return unit_data.get("unit") or unit_data.get("default")
            elif isinstance(unit_data, str):
                return unit_data
        except Exception:
            pass
        return None

# --- 5. 메인 실행 함수 ---
async def main():
    args = {arg.split('=', 1)[0].strip('-'): arg.split('=', 1)[1].strip('"\'') for arg in sys.argv[1:] if '=' in arg}
    
    target_major = args.get('major')
    crawl_mode = "major_only" if target_major else "all"
    
    start_year = args.get('start-year', '2020')
    start_month = args.get('start-month', '01').zfill(2)

    log(f"크롤링 모드: {crawl_mode}, 타겟: {target_major or '전체'}, 시작: {start_year}-{start_month}", "SUMMARY")

    if crawl_mode == "all":
        for major_name in INCLUSION_LIST.keys():
            log(f"\n=== 대분류: {major_name} 크롤링 시작 ===", "SUMMARY")
            crawler = KpiCrawler(target_major=major_name, crawl_mode="major_only", start_year=start_year, start_month=start_month)
            await crawler.run()
    else:
        crawler = KpiCrawler(target_major=target_major, crawl_mode=crawl_mode, start_year=start_year, start_month=start_month)
        await crawler.run()

if __name__ == "__main__":
    asyncio.run(main())
