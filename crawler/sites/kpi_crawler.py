# -*- coding: utf-8 -*-

import os
import asyncio
import sys
import re
import psutil
from datetime import datetime
from dotenv import load_dotenv
from playwright.async_api import async_playwright
from upstash_redis import AsyncRedis
from jsonc_parser import parse_jsonc
# data_processor는 아래에서 초기화 후 사용하므로 여기서 직접 import할 필요가 줄어듭니다.
# from data_processor import create_data_processor, log

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
        # 시작 날짜는 기본값으로 2020년 1월을 사용
        self.start_year = start_year
        self.start_month = start_month

        self.processor = create_data_processor('kpi')

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
                browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
                self.context = await browser.new_context()
                self.page = await self.context.new_page()

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
        """로그인 수행"""
        log("로그인 페이지로 이동 중...")
        await self.page.goto(f"{self.base_url}/www/member/login.asp", timeout=60000, wait_until="networkidle")
        
        username = os.environ.get("KPI_USERNAME")
        password = os.environ.get("KPI_PASSWORD")

        if not username or not password:
            raise ValueError("KPI_USERNAME, KPI_PASSWORD 환경 변수를 설정해야 합니다.")

        await self.page.locator("#user_id").fill(username)
        await self.page.locator("#user_pw").fill(password)
        await self.page.locator("#sendLogin").click()
        
        await self.page.wait_for_load_state('networkidle', timeout=45000)
        log("로그인 성공", "SUCCESS")

    async def _navigate_to_category(self):
        """카테고리 페이지로 이동 및 팝업 처리"""
        log("종합물가정보 페이지로 이동 중...")
        await self.page.goto(f"{self.base_url}/www/price/category.asp", timeout=60000, wait_until="networkidle")
        
        # 팝업 닫기 시도
        popups = await self.page.query_selector_all(".pop-btn-close")
        for popup_close in popups:
            try:
                if await popup_close.is_visible():
                    await popup_close.click(timeout=3000)
                    log("팝업 닫기 성공")
            except Exception:
                continue
        
        log("카테고리 페이지 이동 완료", "SUCCESS")

    async def _crawl_categories(self):
        """
        [최종 수정본] 대분류 -> 중분류 -> 소분류 순차적으로 크롤링.
        화면을 가리는 요소를 제거하는 로직을 추가하여 클릭 오류를 해결합니다.
        """
        major_selector = '#left_menu_kpi > ul.panel > li.file-item > a'
        major_categories_elements = await self.page.locator(major_selector).all()

        major_links = []
        for cat in major_categories_elements:
            name = await cat.inner_text()
            href = await cat.get_attribute('href')
            if name in INCLUSION_LIST:
                major_links.append({'name': name, 'href': href})

        for major in major_links:
            if self.target_major_category and major['name'] != self.target_major_category:
                continue

            log(f"대분류 '{major['name']}' 크롤링 시작...")
            await self.page.goto(f"{self.base_url}{major['href']}")
            await self.page.wait_for_load_state('networkidle', timeout=45000)

            # --- ★★★ 문제 해결을 위한 코드 추가 (시작) ★★★ ---
            # 페이지 이동 후, 클릭을 방해할 수 있는 'Right Quick' 메뉴를 숨깁니다.
            try:
                close_button = self.page.locator("#right_quick .q_cl")
                if await close_button.is_visible(timeout=5000): # 5초 동안 기다려봄
                    await close_button.click()
                    log("  'Right Quick' 메뉴를 숨겼습니다.")
                    await self.page.wait_for_timeout(1000) # 숨겨지는 애니메이션 대기
            except Exception:
                # 메뉴가 없거나 이미 숨겨져 있는 경우, 오류를 무시하고 계속 진행
                log("  'Right Quick' 메뉴가 없거나 이미 숨겨져 있어 계속 진행합니다.", "DEBUG")
            # --- ★★★ 문제 해결을 위한 코드 추가 (끝) ★★★ ---

            open_sub_button = self.page.locator('a[href="javascript:openSub();"]')
            if await open_sub_button.count() > 0:
                log("  openSub() 버튼 클릭하여 모든 분류 펼치는 중...")
                await open_sub_button.click()
                await self.page.wait_for_timeout(5000)

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

    async def _crawl_subcategories_parallel(self, major_name, middle_name, sub_categories_info):
        """[수정본] 소분류 병렬 크롤링 후 중분류 단위로 저장 및 캐시 무효화"""
        if not sub_categories_info:
            log(f"    중분류 '{middle_name}': 처리할 소분류가 없습니다.")
            return

        log(f"    중분류 '{middle_name}': {len(sub_categories_info)}개 소분류를 병렬로 처리합니다.")

        tasks = [self._crawl_single_subcategory(major_name, middle_name, sub_info) for sub_info in sub_categories_info]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_data_for_middle_category = []
        for i, result in enumerate(results):
            sub_name = sub_categories_info[i]['name']
            if isinstance(result, Exception):
                log(f"    ❌ 소분류 '{sub_name}' 처리 중 심각한 오류: {result}", "ERROR")
            elif result: # result가 None이나 빈 리스트가 아닐 경우
                all_data_for_middle_category.extend(result)
        
        if all_data_for_middle_category:
            log(f"  [DB 저장] 중분류 '{middle_name}'의 전체 데이터 {len(all_data_for_middle_category)}개를 저장합니다.")
            saved_count = await self.processor.save_to_supabase(all_data_for_middle_category, 'kpi_price_data')
            if saved_count > 0:
                log(f"  [캐시 무효화] 중분류 '{middle_name}' 관련 캐시를 무효화합니다.")
                await self.clear_redis_cache() # 중분류 완료 후 전체 캐시 무효화
        else:
            log(f"  중분류 '{middle_name}'에서 최종 저장할 데이터가 없습니다.")

    async def _crawl_single_subcategory(self, major_name, middle_name, sub_info):
        """[수정본] 단일 소분류 데이터를 수집하여 List[Dict] 형태로 '반환'"""
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
                    await new_page.goto(sub_url, timeout=60000, wait_until="networkidle")
                    await new_page.click('a[href*="detail_change.asp"]', timeout=15000)
                    
                    spec_dropdown_selector = 'select#ITEM_SPEC_CD'
                    await new_page.wait_for_selector(spec_dropdown_selector, timeout=30000)

                    options = await new_page.locator(f'{spec_dropdown_selector} option').all()
                    specs_to_crawl = [{'name': (await o.inner_text()).strip(), 'value': await o.get_attribute('value')} for o in options if await o.get_attribute('value')]
                    
                    if not specs_to_crawl:
                        await new_page.close()
                        return []

                    all_crawled_data = []
                    for i, spec in enumerate(specs_to_crawl):
                        try:
                            await new_page.select_option(spec_dropdown_selector, value=spec['value'])

                            if i == 0:
                                await new_page.select_option('select#DATA_YEAR_F', value=self.start_year)
                                await new_page.select_option('select#DATA_MONTH_F', value=self.start_month)
                                
                                end_year_selector = 'select#DATA_YEAR_T'
                                latest_year = await new_page.locator(f'{end_year_selector} option').first.get_attribute('value')
                                await new_page.select_option(end_year_selector, value=latest_year)
                                
                                end_month_selector = 'select#DATA_MONTH_T'
                                latest_month = await new_page.locator(f'{end_month_selector} option').first.get_attribute('value')
                                await new_page.select_option(end_month_selector, value=latest_month)
                                log(f"      - 기간 설정: {self.start_year}-{self.start_month} ~ {latest_year}-{latest_month}")
                            
                            async with new_page.expect_response(lambda r: "detail_change.asp" in r.url, timeout=30000):
                                await new_page.click('form[name="sForm"] input[type="image"]')
                            
                            await new_page.wait_for_selector('table#priceTrendDataArea tr:nth-child(2)', timeout=15000)

                            unit = self._get_unit_from_inclusion_list(major_name, middle_name, sub_name, spec['name'])
                            
                            headers = [th.strip() for th in await new_page.locator('table#priceTrendDataArea th').all_inner_texts()]
                            
                            table_type = "region"
                            if len(headers) > 1:
                                header_sample = headers[1]
                                if '가격' in header_sample or re.match(r'가[①-⑩]', header_sample): table_type = "price_name"
                                elif not self._is_region_header(header_sample): table_type = "detail_spec"
                            
                            rows = await new_page.locator('table#priceTrendDataArea tr').all()
                            for row in rows[1:]:
                                cols_text = await row.locator('td').all_inner_texts()
                                if not cols_text: continue
                                date, prices_text = cols_text[0].strip(), [p.strip().replace(',', '') for p in cols_text[1:]]
                                for idx, header in enumerate(headers[1:]):
                                    if idx < len(prices_text) and prices_text[idx].isdigit():
                                        region = "전국" if table_type != "region" else header
                                        detail_spec = header if table_type != "region" else None
                                        all_crawled_data.append(self._create_data_entry(major_name, middle_name, sub_name, spec['name'], region, detail_spec, date, prices_text[idx], unit))
                        except Exception as spec_e:
                            log(f"      - Spec '{spec.get('name', 'N/A')[:20]}...' 처리 오류: {spec_e}", "WARNING")
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
        """[수정본] 중분류 단위 또는 전체 캐시 무효화"""
        if self.redis is None:
            log("  ⚠️ Redis 비활성화, 캐시 삭제 건너뜀.", "WARNING")
            return
            
        try:
            # 특정 중분류에 대한 패턴 생성 대신, 간단하게 모든 자재 가격 캐시를 삭제
            # 이는 더 단순하고 확실한 방법
            keys_to_delete = [key async for key in self.redis.scan_iter("material_prices:*")]
            if keys_to_delete:
                await self.redis.delete(*keys_to_delete)
                log(f"  ✅ Redis 캐시 무효화 성공: {len(keys_to_delete)}개 키 삭제")
            else:
                log("  ✅ 삭제할 Redis 'material_prices:*' 캐시가 없습니다.")
        except Exception as e:
            log(f"  ❌ Redis 캐시 삭제 실패: {str(e)}", "ERROR")

    def _is_region_header(self, header_text):
        """헤더가 일반적인 지역명인지 판별"""
        known_regions = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주", "수원"]
        return any(region in header_text for region in known_regions)

    def _create_data_entry(self, major, middle, sub, spec, region, detail_spec, date, price, unit):
        """데이터베이스 저장을 위한 딕셔너리 객체 생성"""
        final_spec = f"{spec} - {detail_spec}" if detail_spec else spec
        return {'major_category': major, 'middle_category': middle, 'sub_category': sub,
                'specification': final_spec, 'region': region, 'date': f"{date.replace('.', '-')}-01",
                'price': int(price), 'unit': unit}

    def _get_unit_from_inclusion_list(self, major_name, middle_name, sub_name, spec_name=None):
        """INCLUSION_LIST에서 단위 정보 가져오기"""
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
        except Exception as e:
            log(f"단위 정보 조회 중 오류: {e}", "ERROR")
        return None

# --- 5. 메인 실행 함수 ---
async def main():
    """메인 실행 로직: 명령행 인자 파싱 및 크롤러 실행"""
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
    # 이미 실행 중인 크롤러가 있는지 확인하는 로직 (선택적)
    # for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
    #     if 'kpi_crawler.py' in str(proc.info('cmdline')) and proc.pid != os.getpid():
    #         log("이미 실행 중인 크롤러가 있습니다. 종료합니다.", "ERROR")
    #         sys.exit(1)
            
    asyncio.run(main())