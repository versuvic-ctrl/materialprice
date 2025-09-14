

import os
import asyncio
import json
import sys
import re
import psutil
from datetime import datetime
from dotenv import load_dotenv
import pandas as pd
from playwright.async_api import async_playwright
from data_processor import create_data_processor, log
from supabase import create_client, Client

# --- 1. 초기 설정 및 환경변수 로드 ---
load_dotenv("../../.env.local")

# Supabase 클라이언트 초기화
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# --- 2. 웹 크롤러 클래스 ---


def check_running_crawler():
    """이미 실행 중인 크롤러가 있는지 확인"""
    current_pid = os.getpid()
    current_script = os.path.basename(__file__)
    
    running_crawlers = []
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if proc.info['pid'] == current_pid:
                continue
                
            cmdline = proc.info['cmdline']
            if cmdline and any(current_script in cmd for cmd in cmdline):
                running_crawlers.append({
                    'pid': proc.info['pid'],
                    'cmdline': ' '.join(cmdline)
                })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    
    return running_crawlers


# --- 3. Playwright 웹 크롤러 클래스 ---
class KpiCrawler:
    """한국물가정보(KPI) 사이트 크롤러"""

    def __init__(self, crawl_mode="full", max_concurrent=3):
        self.base_url = "https://www.kpi.or.kr"
        self.crawl_mode = crawl_mode  # "full", "test", "common-all"
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.supabase = supabase  # 전역 supabase 객체 참조
        self.test_targets = [
            {"major": "공통자재", "middle": "봉강", "sub": "이형철근(이형봉강)(1)"},
            {"major": "공통자재", "middle": "형강", "sub": "H형강"},
        ]
        # 크롤링 모드에 따른 시작 연도 설정
        if crawl_mode == "test":
            self.start_year = "2025"
        else:
            self.start_year = "2020"
        self.start_month = "01"
        self.processor = create_data_processor('kpi')
        
        # 배치 처리용 변수
        self.batch_data = []
        self.batch_size = 5  # 소분류 5개마다 처리
        self.processed_count = 0

    async def run(self):
        """크롤링 프로세스 실행"""
        async with async_playwright() as p:
            # headless=False로 브라우저 동작 확인
            browser = await p.chromium.launch(headless=False)
            self.context = await browser.new_context()
            self.page = await self.context.new_page()

            await self._login()
            await self._navigate_to_category()
            await self._crawl_categories()
            
            # 마지막 남은 배치 데이터 처리
            await self._process_final_batch()
            
            log(f"\n=== 크롤링 완료: 총 {self.processed_count}개 소분류 처리됨 ===\n")

            await browser.close()
            return self.processor

    async def _login(self):
        """로그인 페이지로 이동하여 로그인 수행"""
        await self.page.goto(f"{self.base_url}/www/member/login.asp")

        username = os.environ.get("KPI_USERNAME")
        password = os.environ.get("KPI_PASSWORD")

        if not username or not password:
            raise ValueError(".env.local 파일에 KPI_USERNAME과 "
                             "KPI_PASSWORD를 설정해야 합니다.")

        await self.page.locator("#user_id").fill(username)
        await self.page.locator("#user_pw").fill(password)
        await self.page.locator("#sendLogin").click()

        await self.page.wait_for_load_state('networkidle')
        log("로그인 완료", "SUCCESS")

    async def _navigate_to_category(self):
        """카테고리 페이지로 이동 및 초기 설정"""
        log("종합물가정보 카테고리 페이지로 이동합니다.")
        await self.page.goto(f"{self.base_url}/www/price/category.asp")

        # Right Quick 메뉴 숨기기
        try:
            close_button = self.page.locator("#right_quick .q_cl")
            if await close_button.is_visible():
                await close_button.click()
                log("Right Quick 메뉴를 숨겼습니다.")
        except Exception as e:
            log(f"Right Quick 메뉴 숨기기 실패 "
                f"(이미 숨겨져 있을 수 있음): {e}")

    async def _crawl_categories(self):
        """대분류 -> 중분류 -> 소분류 순차적으로 크롤링"""
        major_selector = '#left_menu_kpi > ul.panel'
        major_categories = await self.page.locator(
            major_selector).first.locator('li.file-item > a').all()

        major_links = []
        for cat in major_categories:
            text = await cat.inner_text()
            href = await cat.get_attribute('href')
            major_links.append({'name': text, 'url': f"{self.base_url}{href}"})

        for major in major_links:
            # 크롤링 모드에 따른 필터링
            if self.crawl_mode == "test":
                test_majors = [t['major'] for t in self.test_targets]
                if major['name'] not in test_majors:
                    continue  # 테스트 모드일 경우 대상 대분류만 실행
            elif self.crawl_mode == "common-all":
                if major['name'] != "공통자재":
                    continue  # 공통자재 전체 모드일 경우 공통자재만 실행

            log(f"대분류 '{major['name']}' 크롤링 시작...")
            await self.page.goto(major['url'])
            await self.page.wait_for_selector("#div_cate")

            # openSub() 버튼 클릭하여 모든 중분류와 소분류를 한번에 펼치기
            open_sub_selector = 'a[href="javascript:openSub();"]'
            open_sub_button = self.page.locator(open_sub_selector)
            if await open_sub_button.count() > 0:
                log("openSub() 버튼을 클릭하여 모든 분류를 펼칩니다.")
                await open_sub_button.click()
                # 분류가 펼쳐질 시간을 기다림
                await self.page.wait_for_timeout(2000)

                # HTML 구조 확인을 위해 페이지 내용 출력
                html_content = await self.page.content()
                # HTML 구조 확인을 위해 페이지 내용 출력
                part_ttl_start = html_content.find('part-ttl')
                if 'part-ttl' in html_content:
                    sample_end = part_ttl_start + 1000
                    html_sample = html_content[part_ttl_start:sample_end]
                    log(f"페이지 HTML 샘플 (part-ttl 관련): {html_sample}")
                else:
                    log("페이지 HTML 샘플 (part-ttl 관련): "
                        "part-ttl 없음")
            else:
                # 대분류 '공통자재' 클릭하여 중분류 목록 펼치기
                category_link = 'a[href="category.asp?CATE_CD=101"]'
                await self.page.click(category_link)
                await self.page.wait_for_timeout(1000)
                log("중분류 및 소분류 목록을 펼쳤습니다.")

            # 소분류 목록이 나타날 때까지 대기
            await self.page.wait_for_selector(".part-list")

            # 중분류 정보를 미리 수집
            middle_selector = '.part-ttl > a'
            middle_categories_elements = await self.page.locator(
                middle_selector).all()
            log(f"  발견된 중분류 개수: {len(middle_categories_elements)}")

            middle_categories_info = []
            for i, middle_element in enumerate(middle_categories_elements):
                try:
                    middle_name = await middle_element.inner_text()
                    middle_href = await middle_element.get_attribute('href')
                    if middle_href and 'CATE_CD=' in middle_href:
                        middle_categories_info.append({
                            'name': middle_name,
                            'href': middle_href
                        })
                        log(f"  발견된 중분류: '{middle_name}' "
                            f"(CATE_CD: {middle_href})")
                except Exception as e:
                    log(f"  중분류 {i + 1} 정보 수집 중 오류: {str(e)}")
                    continue

            # 각 중분류를 순차적으로 방문하여 소분류 수집
            for middle_info in middle_categories_info:
                middle_name = middle_info['name']
                middle_href = middle_info['href']
                
                # 크롤링 모드에 따른 중분류 필터링
                if self.crawl_mode == "test":
                    test_middles = [t['middle'] for t in self.test_targets 
                                   if t['major'] == major['name']]
                    if middle_name not in test_middles:
                        continue  # 테스트 모드일 경우 대상 중분류만 실행

                try:
                    # 중분류 페이지로 이동
                    middle_url = f"{self.base_url}/www/price/{middle_href}"
                    log(f"  중분류 '{middle_name}' "
                        f"페이지로 이동: {middle_url}")
                    await self.page.goto(middle_url)
                    await self.page.wait_for_load_state(
                        'networkidle')

                    # 소분류가 숨겨져 있을 수 있으므로 직접 찾기
                    await self.page.wait_for_timeout(2000)

                    # 다양한 방법으로 소분류 찾기
                    sub_categories_info = []

                    # 방법 1: ul.part-list 내의 링크들
                    part_list_selector = 'ul.part-list'
                    part_lists = await self.page.locator(
                        part_list_selector).all()
                    for part_list in part_lists:
                        if await part_list.count() > 0:
                            sub_selector = 'li a'
                            sub_elements = await part_list.locator(
                                sub_selector).all()
                            for sub_element in sub_elements:
                                try:
                                    sub_name = await sub_element.inner_text()
                                    sub_href = await sub_element.get_attribute(
                                        'href')
                                    has_cate_cd = (
                                        sub_href and
                                        'CATE_CD=' in sub_href)
                                    if has_cate_cd:
                                        sub_categories_info.append({
                                            'name': sub_name,
                                            'href': sub_href
                                        })
                                        log(f"    발견된 소분류: "
                                            f"'{sub_name}'")
                                except Exception as e:
                                    log(f"    소분류 정보 수집 중 오류: "
                                        f"{str(e)}")
                                    continue

                    # 방법 2: 만약 위에서 찾지 못했다면 다른 선택자 시도
                    if not sub_categories_info:
                        try:
                            # 소분류 링크 찾기
                            detail_selector = (
                                'a[href*="detail.asp?CATE_CD="]')
                            all_links = await self.page.locator(
                                detail_selector).all()
                            for link in all_links:
                                try:
                                    sub_name = await link.inner_text()
                                    sub_href = await link.get_attribute(
                                        'href')
                                    if sub_href and sub_name.strip():
                                        sub_categories_info.append({
                                            'name': sub_name.strip(),
                                            'href': sub_href
                                        })
                                except Exception:
                                    continue
                        except Exception as e:
                            # 방법2 소분류 검색 중 오류 발생 (로그 생략)
                            pass

                    if not sub_categories_info:
                        log(f"    중분류 '{middle_name}'의 "
                            f"소분류를 찾을 수 없습니다.")
                        continue

                    sub_count = len(sub_categories_info)
                    log(f"    중분류 '{middle_name}' - "
                        f"발견된 소분류 개수: {sub_count}")

                    # 수집된 소분류 정보로 병렬 데이터 크롤링
                    await self._crawl_subcategories_parallel(
                        major['name'], middle_name, sub_categories_info)

                except Exception as e:
                    log(f"  중분류 '{middle_name}' 처리 중 오류: {str(e)}")
                    continue

    async def _crawl_subcategories_parallel(self, major_name,
                                            middle_name,
                                            sub_categories_info):
        """소분류들을 병렬로 크롤링"""
        # 크롤링 모드에 따른 소분류 필터링
        if self.crawl_mode == "test":
            filtered_subs = []
            for sub_info in sub_categories_info:
                sub_name = sub_info['name']
                is_target = any(
                    (t['major'] == major_name and
                     t['middle'] == middle_name and
                     t['sub'] == sub_name)
                    for t in self.test_targets
                )
                if is_target:
                    filtered_subs.append(sub_info)
            sub_categories_info = filtered_subs
        # common-all 모드에서는 모든 소분류 처리 (필터링 없음)

        if not sub_categories_info:
            log(f"    중분류 '{middle_name}': "
                f"처리할 소분류가 없습니다.")
            return

        sub_count = len(sub_categories_info)
        log(f"    중분류 '{middle_name}': {sub_count}개 "
            f"소분류를 병렬로 처리합니다.")

        # 병렬 작업 생성
        tasks = []
        for sub_info in sub_categories_info:
            task = self._crawl_single_subcategory(
                major_name, middle_name, sub_info)
            tasks.append(task)

        # 병렬 실행
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 결과 처리 및 배치 데이터 수집
        success_count = 0
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                sub_name = sub_categories_info[i]['name']
                log(f"    소분류 '{sub_name}' 처리 실패: {str(result)}")
            else:
                success_count += 1
                # 성공한 소분류 데이터를 배치에 추가
                sub_info = sub_categories_info[i]
                self.batch_data.append({
                    'major': major_name,
                    'middle': middle_name,
                    'sub': sub_info['name'],
                    'result': result
                })
                
                # 배치 크기에 도달하면 처리
                if len(self.batch_data) >= self.batch_size:
                    await self._process_batch()

        total_count = len(sub_categories_info)
        log(f"    중분류 '{middle_name}' 완료: "
            f"{success_count}/{total_count}개 성공")
    
    async def _process_batch(self):
        """배치 데이터 처리 (pandas 가공 및 supabase 저장)"""
        if not self.batch_data:
            return
            
        batch_count = len(self.batch_data)
        log(f"\n=== 배치 처리 시작: {batch_count}개 소분류 ===\n")
        
        # 각 소분류별로 데이터 처리
        total_processed = 0
        total_saved = 0
        
        for batch_item in self.batch_data:
            try:
                # pandas 가공
                processed_data = await self.processor.process_data(
                    batch_item['major'], 
                    batch_item['middle'], 
                    batch_item['sub']
                )
                
                if processed_data:
                    processed_count = len(processed_data)
                    total_processed += processed_count
                    
                    # supabase 저장
                    saved_count = await self.processor.save_to_supabase(processed_data)
                    total_saved += saved_count
                    
                    log(f"  - {batch_item['sub']}: pandas 가공 {processed_count}개, "
                        f"supabase 저장 {saved_count}개")
                else:
                    log(f"  - {batch_item['sub']}: 처리할 데이터 없음")
                    
            except Exception as e:
                log(f"  - {batch_item['sub']} 처리 실패: {str(e)}")
        
        log(f"\n=== 배치 처리 완료: pandas 가공 {total_processed}개, "
            f"supabase 저장 {total_saved}개 ===\n")
        
        # 배치 데이터 초기화
        self.batch_data = []
        self.processed_count += batch_count
    
    async def _process_final_batch(self):
        """마지막 남은 배치 데이터 처리"""
        if self.batch_data:
            log(f"\n=== 최종 배치 처리: {len(self.batch_data)}개 소분류 ===\n")
            await self._process_batch()

    async def _crawl_single_subcategory(self, major_name,
                                        middle_name, sub_info):
        """단일 소분류 크롤링 (세마포어로 동시 실행 수 제한)"""
        async with self.semaphore:
            sub_name = sub_info['name']
            sub_href = sub_info['href']
            sub_url = f"{self.base_url}/www/price/{sub_href}"

            log(f"  - 중분류 '{middle_name}' > "
                f"소분류 '{sub_name}' 데이터 수집 시작")

            try:
                # 새로운 페이지 컨텍스트 생성 (병렬 처리를 위해)
                new_page = await self.context.new_page()
                await new_page.goto(sub_url)
                await new_page.wait_for_load_state('networkidle')

                # 가격 데이터 수집
                result = await self._get_price_data_with_page(
                    new_page, major_name, middle_name, sub_name, sub_url)

                # 페이지 정리
                await new_page.close()

                # 수집된 데이터가 있으면 즉시 처리하고 저장
                has_data = (result and hasattr(result, 'raw_data_list')
                            and result.raw_data_list)
                if has_data:
                    log(f"  - 소분류 '{sub_name}' 데이터 처리 및 저장 시작")

                    # DataFrame으로 변환
                    df = result.to_dataframe()

                    if not df.empty:
                        # Supabase에 저장 (중복 체크 활성화)
                        result.save_to_supabase(df, 'kpi_price_data', check_duplicates=True)
                        log(f"  ✅ '{sub_name}' 완료: "
                            f"{len(df)}개 데이터 → Supabase 저장 성공")
                    else:
                        log(f"  ⚠️ '{sub_name}' 완료: 저장할 데이터 없음")

                return result

            except Exception as e:
                error_msg = (f"  소분류 '{sub_name}' 처리 중 오류 "
                             f"[대분류: {major_name}, 중분류: {middle_name}]: "
                             f"{str(e)}")
                log(error_msg)
                raise e

    async def _get_price_data(self, major_name, middle_name,
                             sub_name, sub_url):
        """기존 메서드 호환성을 위한 래퍼"""
        return await self._get_price_data_with_page(
            self.page, major_name, middle_name, sub_name, sub_url)



    async def _check_existing_data(self, major_name, middle_name, 
                                  sub_name, spec_name):
        """Supabase에서 기존 데이터 확인하여 중복 체크"""
        try:
            response = self.supabase.table('kpi_price_data').select(
                'date, region, price, specification'
            ).eq(
                'major_category', major_name
            ).eq(
                'middle_category', middle_name
            ).eq(
                'sub_category', sub_name
            ).eq(
                'specification', spec_name
            ).execute()
            
            if response.data:
                # (날짜, 지역, 가격, 규격) 조합으로 완전 중복 체크
                # pandas 가공 후 컬럼명 변경 고려 (region_name -> region)
                existing_data = set()
                for item in response.data:
                    existing_data.add((item['date'], item['region'], str(item['price']), item['specification']))
                log(f"        - 기존 데이터 발견: {len(existing_data)}개 (날짜-지역-가격-규격 조합)")
                return existing_data
            else:
                log("        - 기존 데이터 없음: 전체 추출 필요")
                return set()
                
        except Exception as e:
            log(f"        - 기존 데이터 확인 중 오류: {str(e)}")
            return set()  # 오류 시 전체 추출
    
    async def _get_available_date_range(self, page):
        """페이지에서 사용 가능한 날짜 범위 확인"""
        try:
            # 헤더에서 날짜 정보 추출
            selector = "#priceTrendDataArea th"
            await page.wait_for_selector(selector, timeout=5000)
            header_elements = await page.locator(selector).all()

            if len(header_elements) > 1:
                dates = []
                for i in range(1, len(header_elements)):
                    header_text = await header_elements[i].inner_text()
                    dates.append(header_text.strip())
                return dates
            else:
                return []

        except Exception as e:
            log(f"        - 날짜 범위 확인 중 오류: {str(e)}")
            return []

    async def _get_price_data_with_page(self, page, major_name, 
                                        middle_name, sub_name, sub_url):
        """소분류 페이지에서 월별 가격 데이터를 추출"""
        try:
            # 페이지는 이미 로드된 상태로 전달됨
            await page.wait_for_load_state('networkidle')

            # '물가추이 보기' 탭으로 이동
            await page.get_by_role('link', name='물가추이 보기').click()
            await page.wait_for_selector("#ITEM_SPEC_CD", timeout=10000)

            # 규격 선택 옵션들 가져오기
            spec_options = await page.locator('#ITEM_SPEC_CD option').all()

            raw_item_data = {
                'major_category_name': major_name,
                'middle_category_name': middle_name,
                'sub_category_name': sub_name,
                'spec_data': []
            }

            # 병렬 처리를 위해 규격 데이터를 먼저 수집
            spec_list = []
            for option in spec_options:
                spec_value = await option.get_attribute('value')
                spec_name = await option.inner_text()
                if spec_value and spec_name.strip():  # 빈 값 제외
                    spec_list.append({'value': spec_value, 'name': spec_name})

            # 모든 규격을 최적화된 순차 처리로 진행
            log(f"    - {len(spec_list)}개 규격을 "
                f"최적화된 순차 처리로 진행합니다.")
            await self._process_specs_optimized(
                page, spec_list, raw_item_data,
                major_name, middle_name, sub_name)

        except Exception as e:
            log(f"  소분류 '{sub_name}' 처리 중 오류 "
                f"[대분류: {major_name}, 중분류: {middle_name}]: {str(e)}")
            return None

        # 수집된 데이터 처리 - 새로운 DataProcessor 인스턴스 생성
        local_processor = create_data_processor('kpi')
        if raw_item_data['spec_data']:
            local_processor.add_raw_data(raw_item_data)
            spec_count = len(raw_item_data['spec_data'])
            log(f"  - '{sub_name}' 데이터 수집 완료 "
                f"(총 {spec_count}개 규격)")
        else:
            log(f"  - '{sub_name}': 수집된 규격 데이터 없음")

        return local_processor

    async def _process_specs_optimized(
            self, page, spec_list, raw_item_data,
            major_name, middle_name, sub_name):
        """최적화된 순차 처리 - 페이지 리로드 없이 빠른 규격 변경"""
        for i, spec in enumerate(spec_list):
            try:
                spec_value = spec['value']
                spec_name = spec['name']
                log(f"      - 규격 {i + 1}/{len(spec_list)}: "
                    f"'{spec_name}' 조회 중...")

                # 기존 데이터 확인
                existing_dates = await self._check_existing_data(
                    major_name, middle_name, sub_name, spec_name
                )

                # 규격 선택 (대기 시간 최소화)
                spec_selector = '#ITEM_SPEC_CD'
                await page.locator(spec_selector).select_option(
                    value=spec_value)
                await page.wait_for_load_state('networkidle', timeout=3000)

                # 기간 선택 (첫 번째 규격에서만 설정)
                if i == 0:
                    # 시작 기간: 2020년 1월
                    year_from_selector = '#DATA_YEAR_F'
                    month_from_selector = '#DATA_MONTH_F'
                    await page.locator(year_from_selector).select_option(
                        value='2020')
                    await page.locator(month_from_selector).select_option(
                        value='01')
                    
                    # 종료 기간: 현재 년월
                    current_date = datetime.now()
                    current_year = str(current_date.year)
                    current_month = str(current_date.month).zfill(2)
                    
                    year_to_selector = '#DATA_YEAR_T'
                    month_to_selector = '#DATA_MONTH_T'
                    await page.locator(year_to_selector).select_option(
                        value=current_year)
                    await page.locator(month_to_selector).select_option(
                        value=current_month)
                    
                    await page.wait_for_load_state(
                        'networkidle', timeout=3000)
                    
                    # 검색 버튼 클릭 (기간 설정 후 반드시 실행)
                    search_selector = 'form[name="sForm"] input[type="image"]'
                    search_button = page.locator(search_selector)
                    await search_button.click(timeout=5000)
                    log(f"        - 기간 설정 완료: 2020.01 ~ "
            f"{current_year}.{current_month}")
                else:
                    # 첫 번째 규격이 아닌 경우에도 검색 버튼 클릭
                    search_selector = 'form[name="sForm"] input[type="image"]'
                    search_button = page.locator(search_selector)
                    await search_button.click(timeout=5000)

                # 테이블 로딩 대기 (데이터가 로드될 때까지)
                table_selector = "#priceTrendDataArea tr"
                await page.wait_for_selector(table_selector, timeout=8000)
                await page.wait_for_load_state('networkidle', timeout=5000)

                # 사용 가능한 날짜 범위 확인
                available_dates = await self._get_available_date_range(page)
                if not available_dates:
                    log("        - 사용 가능한 날짜 없음")
                    continue
                
                # 기존 데이터에서 날짜만 추출하여 비교
                existing_date_set = set()
                if existing_dates:
                    existing_date_set = {item[0] for item in existing_dates}  # 튜플의 첫 번째 요소(날짜)만 추출
                
                # 누락된 날짜만 추출
                missing_dates = [date for date in available_dates 
                               if date not in existing_date_set]
                
                if not missing_dates:
                    continue
                
                # 누락된 날짜에 대해서만 가격 데이터 추출
                await self._extract_price_data_fast(
                    page, spec_name, raw_item_data, existing_dates)

            except Exception as e:
                # 규격 처리 중 오류
                log(f"규격 '{spec['name']}' 처리 오류: {str(e)}", "ERROR")
                continue

    async def _extract_price_data_fast(self, page, spec_name,
                                       raw_item_data, existing_dates=None):
        """빠른 가격 데이터 추출 - 누락된 데이터만 추출"""
        try:
            # 물가추이 보기 탭의 테이블 구조 (실제 확인된 구조):
            # - 첫 번째 행: 지역 헤더 ("구분", "서①울", "서②울", "부①산", ...)
            # - 두 번째 행부터: 날짜별 데이터 ("2024. 9", 가격1, 가격2, ...)
            
            # 지역 헤더 행 추출 (첫 번째 행)
            region_header_row = None
            region_header_elements = []
            
            # 테이블에서 첫 번째 행 찾기 (지역 헤더)
            all_table_rows = await page.locator("table").nth(1).locator("tr").all()  # 두 번째 테이블 사용
            if len(all_table_rows) >= 1:
                region_header_row = all_table_rows[0]
                region_header_elements = await region_header_row.locator("td").all()
                if not region_header_elements:
                    region_header_elements = await region_header_row.locator("th").all()
                log(f"      - 지역 헤더 발견 (첫 번째 행): "
                    f"{len(region_header_elements)}개 컬럼")
            
            if not region_header_elements:
                log(f"      - 규격 '{spec_name}': 지역 헤더를 찾을 수 없음")
                return

            # 지역 헤더 추출 (첫 번째 컬럼 '구분' 제외, 유효한 지역만)
            regions = []
            # 유효한 지역의 인덱스 저장
            valid_region_indices = []
            for i in range(1, len(region_header_elements)):
                header_text = await region_header_elements[i].inner_text()
                region_name = self._clean_region_name(header_text.strip())
                if self._is_valid_region_name(region_name):
                    regions.append(region_name)
                    valid_region_indices.append(i)

            if not regions:
                return

            # 데이터 행 추출 (두 번째 행부터 - 날짜별 데이터)
            data_rows = []
            if len(all_table_rows) >= 2:
                data_rows = all_table_rows[1:]  # 첫 번째 행(지역 헤더) 제외
            
            if not data_rows:
                return

            extracted_count = 0
            # 각 날짜별 데이터 처리 (행이 날짜, 열이 지역)
            for row_idx, row in enumerate(data_rows):
                try:
                    # 첫 번째 셀에서 날짜 추출
                    date_element = row.locator("td").first
                    if not await date_element.count():
                        date_element = row.locator("th").first

                    if not await date_element.count():
                        continue

                    date_str = await date_element.inner_text()
                    date_clean = date_str.strip()
                    
                    # 날짜 형식 변환 및 중복 체크
                    if not self._is_valid_date_value(date_clean):
                        continue
                    
                    formatted_date = self._format_date_header(date_clean)
                    if not formatted_date:
                        continue
                    
                    # 이 날짜에 대해 처리할 지역들을 확인
                    
                    # 날짜 유효성 재검증 (추가 검증)
                    if not self._is_valid_date_header(date_clean):
                        continue

                    # 해당 행의 모든 가격 셀 추출 (첫 번째 셀 제외)
                    price_cells = await row.locator("td").all()
                    if not price_cells:
                        # td가 없으면 th에서 추출 (첫 번째 제외)
                        all_cells = await row.locator("th").all()
                        price_cells = all_cells[1:] if len(all_cells) > 1 else []

                    # 각 지역별 가격 처리 (열이 지역)
                    for region_idx, region_name in enumerate(regions):
                        # 가격 셀 인덱스는 1부터 시작 (첫 번째 셀은 날짜)
                        cell_idx = region_idx + 1
                        if cell_idx >= len(price_cells):
                            continue
                            
                        price_cell = price_cells[cell_idx]
                        price_str = await price_cell.inner_text()
                        
                        if self._is_valid_price(price_str):
                            clean_price = (price_str.strip()
                                        .replace(',', ''))
                            try:
                                price_value = float(clean_price)
                                
                                # (날짜, 지역, 가격, 규격) 조합으로 완전 중복 체크
                                if existing_dates and (formatted_date, region_name, str(price_value), spec_name) in existing_dates:
                                    continue
                                price_data = {
                                    'spec_name': spec_name,
                                    'region': region_name,
                                    'date': formatted_date,
                                    'price': price_value
                                }
                                spec_data = raw_item_data['spec_data']
                                spec_data.append(price_data)
                                extracted_count += 1
                                
                                # 로그 최적화: 개별 데이터 로그 제거
                                if extracted_count % 50 == 0:  # 50개마다 진행상황만 표시
                                    log(f"진행: {extracted_count}개 추출됨")
                            except ValueError as ve:
                                continue
                        else:
                            # 가격 추출 실패 - 로그 생략
                            continue
                except Exception as e:
                    log(f"      - 행 처리 중 오류: {str(e)}")
                    continue

            if extracted_count > 0:
                log(f"'{spec_name}': {extracted_count}개 완료", "SUCCESS")

        except Exception as e:
            log(f"'{spec_name}' 오류: {str(e)}", "ERROR")

    def _clean_region_name(self, region_str):
        """지역명 정리 함수"""
        # 동그라미 숫자를 일반 숫자로 변환
        circle_to_num = {
            '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5',
            '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9', '⑩': '10'
        }
        clean_region = region_str.strip()
        for circle, num in circle_to_num.items():
            clean_region = clean_region.replace(circle, num)
        return clean_region

    def _is_valid_date_header(self, header_text):
        """날짜 헤더 유효성 검증 함수"""
        if not header_text or not header_text.strip():
            return False

        header_str = header_text.strip()
        
        # 빈 문자열이나 공백만 있는 경우
        if not header_str or header_str.isspace():
            return False

        # 날짜 패턴 확인 (다양한 형식 지원)
        date_patterns = [
            r'^\d{4}\.\d{1,2}$',  # YYYY.M
            r'^\d{4}-\d{1,2}$',   # YYYY-M
            r'^\d{4}/\d{1,2}$',   # YYYY/M
            r'^\d{4}\.\s*\d{1,2}$',  # YYYY. M (공백 포함)
            r'^\d{4}년\s*\d{1,2}월$',  # YYYY년 M월
            r'^\d{4}\s+\d{1,2}$'  # YYYY M (공백으로 구분)
        ]
        
        for pattern in date_patterns:
            if re.match(pattern, header_str):
                return True

        # 기타 잘못된 값 체크 (더 포괄적으로)
        invalid_patterns = [
            '구분', '지역', '평균', '전국', '기준', '합계', '총계', '소계',
            '단위', '원', '천원', '만원', '억원',
            '규격', '품목', '자재', '재료'
        ]
        
        for pattern in invalid_patterns:
            if pattern in header_str:
                log(f"        - 잘못된 패턴으로 인식된 날짜 헤더 제외: {header_str}")
                return False
        
        # 숫자만으로 구성된 경우 (연도나 월만 있는 경우)
        if header_str.isdigit():
            # 4자리 숫자는 연도로 인정
            if len(header_str) == 4 and 1900 <= int(header_str) <= 2100:
                return True
            # 1-2자리 숫자는 월로 인정
            elif len(header_str) <= 2 and 1 <= int(header_str) <= 12:
                return True
            else:
                return False

        return False

    def _format_date_header(self, header_text):
        """날짜 헤더를 YYYY-MM-01 형식으로 변환"""
        if not header_text or not header_text.strip():
            return header_text
            
        header_str = header_text.strip()
        
        # 다양한 날짜 형식 패턴 처리
        date_patterns = [
            (r'^(\d{4})\.(\d{1,2})$', '-'),  # YYYY.M
            (r'^(\d{4})-(\d{1,2})$', '-'),   # YYYY-M
            (r'^(\d{4})/(\d{1,2})$', '-'),   # YYYY/M
            (r'^(\d{4})\.\s*(\d{1,2})$', '-'),  # YYYY. M (공백 포함)
            (r'^(\d{4})년\s*(\d{1,2})월$', '-'),  # YYYY년 M월
            (r'^(\d{4})\s+(\d{1,2})$', '-')  # YYYY M (공백으로 구분)
        ]
        
        for pattern, separator in date_patterns:
            match = re.match(pattern, header_str)
            if match:
                year = match.group(1)
                month = match.group(2).zfill(2)  # 월을 2자리로 패딩
                formatted_date = f"{year}-{month}-01"
                # 로그 간소화: 첫 번째 변환만 로그 출력
                if not hasattr(self, '_date_conversion_logged'):
                    log(f"        - 날짜 헤더 변환 예시: {header_str} -> {formatted_date}")
                    self._date_conversion_logged = True
                return formatted_date
        
        # 숫자만으로 구성된 경우 처리
        if header_str.isdigit():
            # 4자리 숫자는 연도로 처리 (1월로 설정)
            if len(header_str) == 4 and 1900 <= int(header_str) <= 2100:
                formatted_date = f"{header_str}-01-01"
                return formatted_date
            # 1-2자리 숫자는 월로 처리 (현재 연도 사용)
            elif len(header_str) <= 2 and 1 <= int(header_str) <= 12:
                current_year = datetime.now().year
                month = header_str.zfill(2)
                formatted_date = f"{current_year}-{month}-01"
                return formatted_date
        
        # 변환 실패 시 원본 반환 (로그 생략)
        return header_text

    def _is_valid_region_name(self, region_name):
        """지역명 유효성 검증 함수"""
        if not region_name or not region_name.strip():
            return False

        region_str = region_name.strip()
        
        # 빈 문자열이나 공백만 있는 경우
        if not region_str or region_str.isspace():
            return False

        # 한국 지역명 패턴 확인 (더 포괄적으로)
        valid_regions = [
            '강원', '경기', '경남', '경북', '광주', '대구', '대전', '부산',
            '서울', '세종', '울산', '인천', '전남', '전북', '제주', '충남', '충북',
            '수원', '성남', '춘천'  # 추가 지역명
        ]

        # 숫자가 포함된 지역명도 허용 (예: 서울1, 부산2)
        for region in valid_regions:
            if region in region_str:
                return True

        # 날짜 패턴이 포함된 경우 지역명이 아님 (더 엄격하게)
        date_patterns = [
            r'\d{4}[./-]\d{1,2}',  # YYYY.M, YYYY/M, YYYY-M
            r'\d{4}\.\s*\d{1,2}',  # YYYY. M (공백 포함)
            r'^\d{4}$',  # 연도만
            r'^\d{1,2}$',  # 월만
            r'^\d{4}년',  # YYYY년
            r'^\d{1,2}월'  # M월
        ]
        
        for pattern in date_patterns:
            if re.search(pattern, region_str):
                # 로그 최적화: 날짜 패턴 제외 로그 생략
                return False

        # 기타 잘못된 값 체크 (더 포괄적으로)
        invalid_patterns = [
            '구분', '평균', '전국', '기준', '합계', '총계', '소계',
            '단위', '원', '천원', '만원', '억원',
            '년', '월', '일', '기간',
            '-', '/', '\\', '|', '+', '='
        ]
        
        for pattern in invalid_patterns:
            if pattern in region_str:
                # 로그 최적화: 잘못된 패턴 제외 로그 생략
                return False
        
        # 숫자만으로 구성된 경우 제외
        if region_str.isdigit():
            return False
        
        # 특수문자만으로 구성된 경우 제외
        if not re.search(r'[가-힣a-zA-Z]', region_str):
            return False

        return True

    def _is_valid_date_value(self, date_value):
        """날짜 값이 유효한지 확인"""
        if date_value is None:
            return False

        # datetime 객체인 경우 유효
        if hasattr(date_value, 'strftime'):
            return True

        # 문자열인 경우 검증
        if isinstance(date_value, str):
            # 동그라미 숫자나 특수문자가 포함된 경우 제외
            circle_chars = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']
            if any(char in date_value for char in circle_chars):
                return False

            # '가격' 등의 텍스트가 포함된 경우 제외
            if any(char in date_value for char in ['가', '격', '구', '분']):
                return False

            # 'YYYY-MM-DD' 형태 확인
            if re.match(r'^\d{4}-\d{2}-\d{2}$', date_value.strip()):
                return True

            # 'YYYY. M' 형태 확인
            date_pattern = r'^\d{4}\.\s*\d{1,2}$'
            if re.match(date_pattern, date_value.strip()):
                return True

        return False

    def _is_valid_price(self, price_str):
        """가격 데이터 유효성 검증"""
        if not price_str:
            return False
        
        price_stripped = price_str.strip()
        if (not price_stripped or 
            price_stripped == '-' or 
            price_stripped == ''):
            return False
            
        clean_price = price_stripped.replace(',', '')
        try:
            float(clean_price)
            return True
        except ValueError:
            return False

    async def _process_specs_parallel(self, spec_list, raw_item_data,
                                     major_name, middle_name, sub_name,
                                     sub_url):
        """여러 규격을 병렬로 처리하는 메서드"""
        semaphore = asyncio.Semaphore(2)  # 최대 2개 동시 처리

        async def process_spec_with_new_page(spec):
            async with semaphore:
                try:
                    # 새로운 페이지 생성
                    new_page = await self.context.new_page()
                    base_url = "https://www.kpi.or.kr/www/price/"
                    await new_page.goto(f"{base_url}{sub_url}")
                    await new_page.wait_for_load_state(
                        'networkidle', timeout=60000)
                    await new_page.wait_for_selector(
                        'body', timeout=5000)

                    # '물가추이 보기' 탭으로 이동 (재시도 로직)
                    for retry in range(3):
                        try:
                            link_name = '물가추이 보기'
                            link_locator = new_page.get_by_role(
                                'link', name=link_name)
                            await link_locator.click(timeout=15000)
                            await new_page.wait_for_selector(
                                "#ITEM_SPEC_CD", timeout=15000)
                            break
                        except Exception as e:
                            if retry == 2:
                                raise e
                            await new_page.reload()
                            await new_page.wait_for_load_state(
                                'domcontentloaded', timeout=10000)
                            await new_page.wait_for_load_state(
                                'networkidle', timeout=30000)

                    # 임시 데이터 구조
                    temp_data = {
                        'major_category_name': major_name,
                        'middle_category_name': middle_name,
                        'sub_category_name': sub_name,
                        'spec_data': []
                    }

                    # 규격 처리
                    await self._process_single_spec(new_page, spec, temp_data)

                    await new_page.close()
                    return temp_data['spec_data']

                except Exception as e:
                    error_msg = (f"    - 병렬 처리 중 규격 '{spec['name']}' 오류 "
                                f"[대분류: {major_name}, 중분류: {middle_name}, "
                                f"소분류: {sub_name}]: {str(e)}")
                    log(error_msg)
                    return []

        # 모든 규격을 병렬로 처리
        # 모든 규격에 대한 병렬 처리 태스크 생성
        tasks = [process_spec_with_new_page(spec)
                 for spec in spec_list]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 결과 병합
        for result in results:
            if isinstance(result, list) and result:
                raw_item_data['spec_data'].extend(result)

    async def _process_single_spec(self, page, spec, raw_item_data):
        """단일 규격에 대한 데이터 처리"""
        spec_value = spec['value']
        spec_name = spec['name']
        log(f"    - 규격: '{spec_name}' 조회 중...")

        max_retries = 3
        for attempt in range(max_retries):
            try:
                # 규격 선택
                # 규격 선택
                spec_locator = page.locator('#ITEM_SPEC_CD')
                await spec_locator.select_option(value=spec_value)
                await page.wait_for_load_state(
                    'networkidle', timeout=3000)

                # 기간 선택
                year_locator = page.locator('#DATA_YEAR_F')
                await year_locator.select_option(value=self.start_year)
                month_locator = page.locator('#DATA_MONTH_F')
                await month_locator.select_option(
                    value=self.start_month)
                await page.wait_for_load_state(
                    'networkidle', timeout=3000)

                # 검색 버튼 클릭 (재시도 로직 추가)
                search_selector = 'form[name="sForm"] input[type="image"]'
                search_button = page.locator(search_selector)
                await search_button.click(timeout=10000)
                await page.wait_for_load_state(
                    'networkidle', timeout=15000)
                break

            except Exception as e:
                if attempt < max_retries - 1:
                    attempt_num = attempt + 1
                    log(f"    - 규격 '{spec_name}' 시도 {attempt_num} "
                        f"실패, 재시도 중...")
                    await page.wait_for_timeout(1000)
                    continue
                else:
                    log(f"    - 규격 '{spec_name}' 최종 실패: "
                        f"{str(e)}")
                    return

        # 데이터 테이블 파싱
        try:
            await page.wait_for_selector(
            "#priceTrendDataArea tr", timeout=10000)

            # 전체 테이블 HTML을 로그로 출력해서 구조 확인
            table_html = await page.locator("#priceTrendDataArea").inner_html()
            log(f"    - 규격 '{spec_name}': 테이블 HTML 구조:\n{table_html[:500]}...")

            header_elements = await page.locator(
            "#priceTrendDataArea th").all()
            if not header_elements:
                log(f"    - 규격 '{spec_name}': 데이터 테이블을 찾을 수 없음")
                return

            # 첫 번째 헤더는 '구분'이므로 제외
            dates = [await h.inner_text() for h in header_elements[1:]]
            log(f"    - 규격 '{spec_name}': 헤더 데이터 = {dates}")

            # 첫 번째 지역 데이터 행만 추출 (예: '서①울')
            data_rows = await page.locator("#priceTrendDataArea tr").all()
            log(f"    - 규격 '{spec_name}': 총 {len(data_rows)}개 행 발견")
            if len(data_rows) < 2:
                log(f"    - 규격 '{spec_name}': 데이터 행을 찾을 수 없음")
                return

            first_row_tds = await data_rows[1].locator("td").all()
            if not first_row_tds:
                log(f"    - 규격 '{spec_name}': 데이터 셀을 찾을 수 없음")
                return

            region = await first_row_tds[0].inner_text()
            prices = [await td.inner_text() for td in first_row_tds[1:]]
            log(f"    - 규격 '{spec_name}': 지역 = {region}, "
                f"가격 데이터 = {prices}")

            # 헤더 정보 추출 (테이블 구조 파악용)
            header_cells = await data_rows[0].locator("th").all()
            headers = []
            for i in range(1, len(header_cells)):  # 첫 번째 컬럼(구분) 제외
                header_text = await header_cells[i].inner_text()
                # 동그라미 숫자를 일반 숫자로 변환 (①②③④⑤⑥⑦⑧⑨⑩ 등 -> 1,2,3)
                circle_to_num = {
                    '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5',
                    '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9', '⑩': '10'
                }
                cleaned_header = header_text.strip()
                for circle, num in circle_to_num.items():
                    cleaned_header = cleaned_header.replace(circle, num)

                # 날짜 형식 검증
                # (YYYY.M 또는 YYYY. M 형태만 허용)
                if self._is_valid_date_header(cleaned_header):
                    headers.append(cleaned_header)
                else:
                    log(f"    - 잘못된 날짜 헤더 제외: "
                        f"'{cleaned_header}' (원본: '{header_text}')")

            log(f"    - 규격 '{spec_name}': "
                f"헤더 데이터 = {headers}")

            price_list = []
            # 테이블 구조 분석: 헤더가 날짜이고 행이 지역별 데이터인 구조
            # 각 지역(행)에 대해 처리
            # 헤더 제외하고 모든 행 처리
            for i in range(1, len(data_rows)):
                try:
                    row_tds = await data_rows[i].locator("td").all()
                    if len(row_tds) >= 2:
                        # 첫 번째 컬럼은 지역명
                        region_str = await row_tds[0].inner_text()
                        # 동그라미 숫자를 일반 숫자로 변환 (①②③ 등 -> 1,2,3)
                        circle_to_num = {
                            '①': '1', '②': '2', '③': '3', '④': '4',
                            '⑤': '5', '⑥': '6', '⑦': '7', '⑧': '8',
                            '⑨': '9', '⑩': '10'
                        }
                        clean_region = region_str.strip()
                        for circle, num in circle_to_num.items():
                            clean_region = clean_region.replace(
                                circle, num)

                        # 각 날짜별 가격 처리
                        for j, date_header in enumerate(headers):
                            if j + 1 < len(row_tds):
                                price_str = await row_tds[j + 1].inner_text()
                                # 가격 데이터 유효성 검증 강화
                                price_stripped = price_str.strip()
                                if price_stripped and price_stripped != '-':
                                    # 쉼표가 포함된 숫자인지 확인
                                    clean_price = price_stripped.replace(
                                        ',', '')
                                    is_valid_price = (
                                        clean_price.isdigit() and
                                        int(clean_price) > 0)
                                    if is_valid_price:
                                        # 날짜 파싱 (YYYY. M 형태)
                                        try:
                                            is_valid_header = (
                                                self._is_valid_date_header(
                                                    date_header))
                                            if is_valid_header:
                                                year_month = (
                                                    date_header.strip()
                                                    .replace(' ', ''))
                                                if '.' in year_month:
                                                    year, month = year_month.split('.')
                                                    date_obj = datetime(
                                                        int(year),
                                                        int(month), 1)
                                                    price_data = {
                                                        'date': date_obj,
                                                        'region': clean_region,
                                                        'price': price_str.strip()
                                                    }
                                                    price_list.append(price_data)
                                                    # 유효한 가격 데이터 추가 로그
                                                    log(
                                                        f"    - 유효한 가격 데이터 추가: "
                                                        f"{clean_region} "
                                                        f"({date_header}) = "
                                                        f"{price_str.strip()}")
                                            else:
                                                # 잘못된 날짜 형식 제외 로그
                                                log(
                                                    f"    - 잘못된 날짜 형식 제외: "
                                                    f"{date_header}")
                                        except Exception as date_parse_error:
                                            # 날짜 파싱 오류 로그
                                            log(
                                                f"    - 날짜 파싱 오류: "
                                                f"{date_header} - "
                                                f"{str(date_parse_error)}")
                except Exception as row_error:
                    # 행 파싱 오류 로그
                    log(f"    - 행 {i} 파싱 오류: {str(row_error)}")
                    continue

            if price_list:
                raw_item_data['spec_data'].append({
                    'specification_name': spec_name,
                    'prices': price_list
                })
                log(f"    - 규격 '{spec_name}': {len(price_list)}개 가격 데이터 수집 완료")
            else:
                log(f"    - 규격 '{spec_name}': 유효한 가격 데이터 없음")

        except Exception as e:
            log(f"    - 규격 '{spec_name}' 데이터 파싱 오류: {str(e)}")
            return


# --- 4. 메인 실행 함수 ---
async def main():
    """메인 실행 로직"""
    # 명령행 인수로 모드 결정
    crawl_mode = "full"  # 기본값
    if '--test' in sys.argv:
        crawl_mode = "test"
    elif '--common-all' in sys.argv:
        crawl_mode = "common-all"
    
    crawler = KpiCrawler(crawl_mode=crawl_mode, max_concurrent=2)
    await crawler.run()

    # 크롤링 완료 메시지
    log("크롤링 완료", "SUCCESS")

if __name__ == "__main__":
    # 중복 실행 체크
    running_crawlers = check_running_crawler()
    if running_crawlers:
        log(f"이미 실행 중인 크롤러 {len(running_crawlers)}개 발견", "ERROR")
        log("기존 크롤러 완료 후 재실행하세요")
        sys.exit(1)
    
    # 명령행 인수로 모드 선택
    # python kpi_crawler.py --test : 테스트 모드 (테스트 타겟만 크롤링)
    # python kpi_crawler.py --common-all : 공통자재 전체 크롤링 모드
    # python kpi_crawler.py : 전체 크롤링 모드
    
    if '--test' in sys.argv:
        log("테스트 모드 시작", "INFO")
    elif '--common-all' in sys.argv:
        log("공통자재 전체 크롤링 시작", "INFO")
    else:
        log("전체 크롤링 시작", "INFO")

    asyncio.run(main())
