

import os
import asyncio
import json
import sys
from datetime import datetime, date
from dotenv import load_dotenv
import pandas as pd
from playwright.async_api import async_playwright
from supabase import create_client, Client

# --- 1. 초기 설정 및 환경변수 로드 ---
load_dotenv("../../.env.local")

# Supabase 클라이언트 초기화
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 로깅 함수
def log(message):
    """실행 과정 로그를 출력하는 함수"""
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {message}")

# --- 2. 데이터 처리를 위한 클래스 및 함수 ---
class DataProcessor:
    """크롤링된 데이터를 처리하고 가공하는 클래스"""

    def __init__(self):
        self.raw_data_list = []
        self.processed_data_list = []

    def add_raw_data(self, data):
        """파싱된 원본 데이터를 추가"""
        self.raw_data_list.append(data)

    def to_dataframe(self):
        """수집된 데이터를 Pandas DataFrame으로 변환"""
        if not self.raw_data_list:
            return pd.DataFrame()

        # 원본 데이터를 기반으로 최종 데이터를 가공
        for raw_item in self.raw_data_list:
            for spec_data in raw_item.get('spec_data', []):
                for price_info in spec_data.get('prices', []):
                    self.processed_data_list.append({
                        'major_category': raw_item['major_category_name'],
                        'middle_category': raw_item['middle_category_name'],
                        'sub_category': raw_item['sub_category_name'],
                        'specification': spec_data['specification_name'],
                        'unit': spec_data.get('unit', '원/톤'),  # 기본값 설정
                        'region': price_info['region'],
                        'date': price_info['date'],
                        'price': int(price_info['price'].replace(',', '')) if price_info['price'] else None
                    })
        
        return pd.DataFrame(self.processed_data_list)

    def save_to_supabase(self, df, table_name):
        """DataFrame을 Supabase 테이블에 저장"""
        if df.empty:
            log("저장할 데이터가 없습니다.")
            return
        
        try:
            records = df.to_dict(orient='records')
            # Supabase는 date 타입을 'YYYY-MM-DD' 형식으로 받습니다.
            for record in records:
                record['date'] = record['date'].strftime('%Y-%m-%d')

            data, error = supabase.table(table_name).upsert(records).execute()
            if error and error.message:
                log(f"Supabase 저장 실패: {error.message}")
            else:
                log(f"총 {len(records)}개의 데이터가 Supabase '{table_name}' 테이블에 성공적으로 저장되었습니다.")
        except Exception as e:
            log(f"Supabase 저장 중 예외 발생: {e}")

    def _convert_datetime_to_string(self, obj):
        """datetime 객체를 문자열로 변환하는 재귀 함수"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, dict):
            return {key: self._convert_datetime_to_string(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_datetime_to_string(item) for item in obj]
        else:
            return obj
    
    def get_comparison_json(self):
        """원본 데이터와 가공된 데이터를 비교하는 JSON 생성"""
        processed_df = self.to_dataframe()
        
        # datetime 객체를 문자열로 변환
        raw_data_converted = self._convert_datetime_to_string(self.raw_data_list)
        processed_data_converted = self._convert_datetime_to_string(processed_df.to_dict(orient='records'))
        
        return json.dumps({
            "raw_crawled_data": raw_data_converted,
            "pandas_processed_data": processed_data_converted
        }, ensure_ascii=False, indent=4)


# --- 3. Playwright 웹 크롤러 클래스 ---
class KpiCrawler:
    """한국물가정보(KPI) 사이트 크롤러"""

    def __init__(self, is_test=False, max_concurrent=3):
        self.base_url = "https://www.kpi.or.kr"
        self.is_test = is_test
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.test_targets = [
            {"major": "공통자재", "middle": "봉강", "sub": "이형철근(이형봉강)(1)"},
            {"major": "공통자재", "middle": "형강", "sub": "H형강"},
        ]
        self.start_year = "2025" if self.is_test else "2020"
        self.start_month = "01"
        self.processor = DataProcessor()

    async def run(self):
        """크롤링 프로세스 실행"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False) # headless=False로 브라우저 동작 확인
            self.context = await browser.new_context()
            self.page = await self.context.new_page()

            await self._login()
            await self._navigate_to_category()
            await self._crawl_categories()

            await browser.close()
            return self.processor

    async def _login(self):
        """로그인 페이지로 이동하여 로그인 수행"""
        log("로그인 페이지로 이동합니다.")
        await self.page.goto(f"{self.base_url}/www/member/login.asp")

        username = os.environ.get("KPI_USERNAME")
        password = os.environ.get("KPI_PASSWORD")

        if not username or not password:
            raise ValueError(".env.local 파일에 KPI_USERNAME과 KPI_PASSWORD를 설정해야 합니다.")

        await self.page.locator("#user_id").fill(username)
        await self.page.locator("#user_pw").fill(password)
        await self.page.locator("#sendLogin").click()
        
        await self.page.wait_for_load_state('networkidle')
        log("로그인 성공.")

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
            log(f"Right Quick 메뉴 숨기기 실패 (이미 숨겨져 있을 수 있음): {e}")

    async def _crawl_categories(self):
        """대분류 -> 중분류 -> 소분류 순차적으로 크롤링"""
        major_categories = await self.page.locator('#left_menu_kpi > ul.panel').first.locator('li.file-item > a').all()
        
        major_links = []
        for cat in major_categories:
            text = await cat.inner_text()
            href = await cat.get_attribute('href')
            major_links.append({'name': text, 'url': f"{self.base_url}{href}"})

        for major in major_links:
            if self.is_test and major['name'] not in [t['major'] for t in self.test_targets]:
                continue # 테스트 모드일 경우 대상 대분류만 실행

            log(f"대분류 '{major['name']}' 크롤링 시작...")
            await self.page.goto(major['url'])
            await self.page.wait_for_selector("#div_cate")

            # openSub() 버튼 클릭하여 모든 중분류와 소분류를 한번에 펼치기
            open_sub_button = self.page.locator('a[href="javascript:openSub();"]')
            if await open_sub_button.count() > 0:
                log("openSub() 버튼을 클릭하여 모든 분류를 펼칩니다.")
                await open_sub_button.click()
                await self.page.wait_for_timeout(2000)  # 분류가 펼쳐질 시간을 기다림
                
                # HTML 구조 확인을 위해 페이지 내용 출력
                html_content = await self.page.content()
                log(f"페이지 HTML 샘플 (part-ttl 관련): {html_content[html_content.find('part-ttl'):html_content.find('part-ttl')+1000] if 'part-ttl' in html_content else 'part-ttl 없음'}")
            else:
                # 대분류 '공통자재' 클릭하여 중분류 목록 펼치기
                await self.page.click('a[href="category.asp?CATE_CD=101"]')
                await self.page.wait_for_timeout(1000)
                log("중분류 및 소분류 목록을 펼쳤습니다.")
            
            await self.page.wait_for_selector(".part-list") # 소분류 목록이 나타날 때까지 대기

            # 중분류 정보를 미리 수집
            middle_categories_elements = await self.page.locator('.part-ttl > a').all()
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
                        log(f"  발견된 중분류: '{middle_name}' (CATE_CD: {middle_href})")
                except Exception as e:
                    log(f"  중분류 {i+1} 정보 수집 중 오류: {str(e)}")
                    continue
            
            # 각 중분류를 순차적으로 방문하여 소분류 수집
            for middle_info in middle_categories_info:
                middle_name = middle_info['name']
                middle_href = middle_info['href']
                
                try:
                    # 중분류 페이지로 이동
                    middle_url = f"{self.base_url}/www/price/{middle_href}"
                    log(f"  중분류 '{middle_name}' 페이지로 이동: {middle_url}")
                    await self.page.goto(middle_url)
                    await self.page.wait_for_load_state('networkidle')
                    
                    # 소분류가 숨겨져 있을 수 있으므로 직접 찾기
                    await self.page.wait_for_timeout(2000)
                    
                    # 다양한 방법으로 소분류 찾기
                    sub_categories_info = []
                    
                    # 방법 1: ul.part-list 내의 링크들
                    part_lists = await self.page.locator('ul.part-list').all()
                    for part_list in part_lists:
                        if await part_list.count() > 0:
                            sub_elements = await part_list.locator('li a').all()
                            for sub_element in sub_elements:
                                try:
                                    sub_name = await sub_element.inner_text()
                                    sub_href = await sub_element.get_attribute('href')
                                    if sub_href and 'CATE_CD=' in sub_href:
                                        sub_categories_info.append({
                                            'name': sub_name,
                                            'href': sub_href
                                        })
                                        log(f"    발견된 소분류: '{sub_name}'")
                                except Exception as e:
                                    log(f"    소분류 정보 수집 중 오류: {str(e)}")
                                    continue
                    
                    # 방법 2: 만약 위에서 찾지 못했다면 다른 선택자 시도
                    if not sub_categories_info:
                        try:
                            all_links = await self.page.locator('a[href*="detail.asp?CATE_CD="]').all()
                            for link in all_links:
                                try:
                                    sub_name = await link.inner_text()
                                    sub_href = await link.get_attribute('href')
                                    if sub_href and sub_name.strip():
                                        sub_categories_info.append({
                                            'name': sub_name.strip(),
                                            'href': sub_href
                                        })
                                        log(f"    발견된 소분류 (방법2): '{sub_name.strip()}'")
                                except Exception as e:
                                    continue
                        except Exception as e:
                            log(f"    방법2 소분류 검색 중 오류: {str(e)}")
                    
                    if not sub_categories_info:
                        log(f"    중분류 '{middle_name}'의 소분류를 찾을 수 없습니다.")
                        continue
                    
                    log(f"    중분류 '{middle_name}' - 발견된 소분류 개수: {len(sub_categories_info)}")
                    
                    # 수집된 소분류 정보로 병렬 데이터 크롤링
                    await self._crawl_subcategories_parallel(major['name'], middle_name, sub_categories_info)
                            
                except Exception as e:
                    log(f"  중분류 '{middle_name}' 처리 중 오류: {str(e)}")
                    continue
    
    async def _crawl_subcategories_parallel(self, major_name, middle_name, sub_categories_info):
        """소분류들을 병렬로 크롤링"""
        # 테스트 모드일 경우 필터링
        if self.is_test:
            filtered_subs = []
            for sub_info in sub_categories_info:
                sub_name = sub_info['name']
                is_target = any(
                    t['major'] == major_name and t['middle'] == middle_name and t['sub'] == sub_name
                    for t in self.test_targets
                )
                if is_target:
                    filtered_subs.append(sub_info)
            sub_categories_info = filtered_subs
        
        if not sub_categories_info:
            log(f"    중분류 '{middle_name}': 처리할 소분류가 없습니다.")
            return
        
        log(f"    중분류 '{middle_name}': {len(sub_categories_info)}개 소분류를 병렬로 처리합니다.")
        
        # 병렬 작업 생성
        tasks = []
        for sub_info in sub_categories_info:
            task = self._crawl_single_subcategory(major_name, middle_name, sub_info)
            tasks.append(task)
        
        # 병렬 실행
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 결과 처리
        success_count = 0
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                log(f"    소분류 '{sub_categories_info[i]['name']}' 처리 실패: {str(result)}")
            else:
                success_count += 1
        
        log(f"    중분류 '{middle_name}' 완료: {success_count}/{len(sub_categories_info)}개 성공")
    
    async def _crawl_single_subcategory(self, major_name, middle_name, sub_info):
        """단일 소분류 크롤링 (세마포어로 동시 실행 수 제한)"""
        async with self.semaphore:
            sub_name = sub_info['name']
            sub_href = sub_info['href']
            sub_url = f"{self.base_url}/www/price/{sub_href}"
            
            log(f"  - 중분류 '{middle_name}' > 소분류 '{sub_name}' 데이터 수집 시작")
            
            try:
                # 새로운 페이지 컨텍스트 생성 (병렬 처리를 위해)
                new_page = await self.context.new_page()
                await new_page.goto(sub_url)
                await new_page.wait_for_load_state('networkidle')
                
                # 가격 데이터 수집
                result = await self._get_price_data_with_page(new_page, major_name, middle_name, sub_name, sub_url)
                
                # 페이지 정리
                await new_page.close()
                
                return result
                
            except Exception as e:
                log(f"  소분류 '{sub_name}' 처리 중 오류: {str(e)}")
                raise e
    
    async def _get_price_data(self, major_name, middle_name, sub_name, sub_url):
        """기존 메서드 호환성을 위한 래퍼"""
        return await self._get_price_data_with_page(self.page, major_name, middle_name, sub_name, sub_url)
    
    async def _check_existing_data(self, major_name, middle_name, sub_name, spec_name):
        """SUPABASE에서 기존 데이터 확인"""
        try:
            response = supabase.table('kpi_price_data').select('date').eq(
                'major_category', major_name
            ).eq(
                'middle_category', middle_name
            ).eq(
                'sub_category', sub_name
            ).eq(
                'specification', spec_name
            ).execute()
            
            if response.data:
                existing_dates = [item['date'] for item in response.data]
                log(f"        - 기존 데이터 발견: {len(existing_dates)}개 날짜")
                return existing_dates
            else:
                log(f"        - 기존 데이터 없음: 전체 추출 필요")
                return []
                
        except Exception as e:
            log(f"        - 기존 데이터 확인 중 오류: {str(e)}")
            return []  # 오류 시 전체 추출
    
    async def _get_available_date_range(self, page):
        """페이지에서 사용 가능한 날짜 범위 확인"""
        try:
            # 헤더에서 날짜 정보 추출
            await page.wait_for_selector("#priceTrendDataArea th", timeout=5000)
            header_elements = await page.locator("#priceTrendDataArea th").all()
            
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
    
    async def _get_price_data_with_page(self, page, major_name, middle_name, sub_name, sub_url):
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
            log(f"    - {len(spec_list)}개 규격을 최적화된 순차 처리로 진행합니다.")
            await self._process_specs_optimized(page, spec_list, raw_item_data, major_name, middle_name, sub_name)
                    
        except Exception as e:
            log(f"  소분류 '{sub_name}' 처리 중 오류: {str(e)}")
            return None
             
        # 수집된 데이터 처리
        if raw_item_data['spec_data']:
            self.processor.add_raw_data(raw_item_data)
            log(f"  - '{sub_name}' 데이터 수집 완료 (총 {len(raw_item_data['spec_data'])}개 규격)")
        else:
            log(f"  - '{sub_name}': 수집된 규격 데이터 없음")
             
        return raw_item_data
    
    async def _process_specs_optimized(self, page, spec_list, raw_item_data, major_name, middle_name, sub_name):
        """최적화된 순차 처리 - 페이지 리로드 없이 빠른 규격 변경"""
        for i, spec in enumerate(spec_list):
            try:
                spec_value = spec['value']
                spec_name = spec['name']
                log(f"      - 규격 {i+1}/{len(spec_list)}: '{spec_name}' 조회 중...")
                
                # SUPABASE에서 기존 데이터 확인
                existing_dates = await self._check_existing_data(major_name, middle_name, sub_name, spec_name)
                
                # 규격 선택 (대기 시간 최소화)
                await page.locator('#ITEM_SPEC_CD').select_option(value=spec_value)
                await asyncio.sleep(0.2)  # 최소 대기
                
                # 기간 선택 (첫 번째 규격에서만 설정)
                if i == 0:
                    await page.locator('#DATA_YEAR_F').select_option(value=self.start_year)
                    await page.locator('#DATA_MONTH_F').select_option(value=self.start_month)
                    await asyncio.sleep(0.2)
                
                # 검색 버튼 클릭
                search_button = page.locator('form[name="sForm"] input[type="image"]')
                await search_button.click(timeout=5000)
                
                # 테이블 로딩 대기 (최소 시간)
                await page.wait_for_selector("#priceTrendDataArea tr", timeout=8000)
                await asyncio.sleep(0.3)  # 데이터 안정화 대기
                
                # 사용 가능한 날짜 범위 확인
                available_dates = await self._get_available_date_range(page)
                
                # 중복 체크 및 필요한 데이터만 추출
                if existing_dates and available_dates:
                    # 기존 데이터와 비교하여 누락된 날짜만 확인
                    missing_dates = [date for date in available_dates if date not in existing_dates]
                    if not missing_dates:
                        log(f"        - '{spec_name}': 모든 데이터가 이미 존재함 (스킵)")
                        continue
                    else:
                        log(f"        - '{spec_name}': {len(missing_dates)}개 누락 날짜 발견, 데이터 추출 진행")
                
                # 데이터 추출 (기존 데이터 정보 전달)
                await self._extract_price_data_fast(page, spec_name, raw_item_data, existing_dates)
                
            except Exception as e:
                log(f"      - 규격 '{spec['name']}' 처리 중 오류: {str(e)}")
                continue
    
    async def _extract_price_data_fast(self, page, spec_name, raw_item_data, existing_dates=None):
        """빠른 가격 데이터 추출 - 누락된 데이터만 추출"""
        try:
            # 헤더 추출
            header_elements = await page.locator("#priceTrendDataArea th").all()
            if not header_elements:
                log(f"      - 규격 '{spec_name}': 데이터 테이블을 찾을 수 없음")
                return
            
            # 날짜 헤더 추출 (첫 번째 컬럼 '구분' 제외)
            dates = []
            for i in range(1, len(header_elements)):
                header_text = await header_elements[i].inner_text()
                dates.append(header_text.strip())
            
            # 기존 데이터가 있는 경우 누락된 날짜만 필터링
            if existing_dates:
                missing_dates = [date for date in dates if date not in existing_dates]
                if not missing_dates:
                    log(f"      - 규격 '{spec_name}': 모든 날짜 데이터가 이미 존재함 (스킵)")
                    return
                dates_to_extract = missing_dates
                log(f"      - 규격 '{spec_name}': {len(missing_dates)}개 누락 날짜만 추출")
            else:
                dates_to_extract = dates
                log(f"      - 규격 '{spec_name}': 전체 {len(dates)}개 날짜 추출")
            
            # 데이터 행 추출
            data_rows = await page.locator("#priceTrendDataArea tr").all()
            if len(data_rows) < 2:
                log(f"      - 규격 '{spec_name}': 데이터 행을 찾을 수 없음")
                return
            
            extracted_count = 0
            # 각 지역별 데이터 처리
            for i in range(1, len(data_rows)):
                try:
                    row_tds = await data_rows[i].locator("td").all()
                    if len(row_tds) >= 2:
                        # 지역명 추출 및 정리
                        region_str = await row_tds[0].inner_text()
                        clean_region = self._clean_region_name(region_str)
                        
                        # 각 날짜별 가격 처리 (누락된 날짜만)
                        for j, date_header in enumerate(dates):
                            if date_header in dates_to_extract and j + 1 < len(row_tds):
                                price_str = await row_tds[j + 1].inner_text()
                                if self._is_valid_price(price_str):
                                    clean_price = price_str.strip().replace(',', '')
                                    try:
                                        price_value = float(clean_price)
                                        price_data = {
                                            'spec_name': spec_name,
                                            'region': clean_region,
                                            'date': date_header,
                                            'price': price_value
                                        }
                                        raw_item_data['spec_data'].append(price_data)
                                        extracted_count += 1
                                    except ValueError:
                                        continue
                except Exception as e:
                    continue
            
            log(f"      - 규격 '{spec_name}': {extracted_count}개 데이터 추출 완료")
            
        except Exception as e:
            log(f"      - 규격 '{spec_name}' 데이터 추출 오류: {str(e)}")
    
    def _clean_region_name(self, region_str):
        """지역명 정리 (동그라미 숫자를 일반 숫자로 변환)"""
        circle_to_num = {
            '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5',
            '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9', '⑩': '10'
        }
        clean_region = region_str.strip()
        for circle, num in circle_to_num.items():
            clean_region = clean_region.replace(circle, num)
        return clean_region
    
    def _is_valid_price(self, price_str):
        """가격 데이터 유효성 검증"""
        if not price_str or price_str.strip() == '-' or price_str.strip() == '':
            return False
        clean_price = price_str.strip().replace(',', '')
        try:
            float(clean_price)
            return True
        except ValueError:
            return False
    
    async def _process_specs_parallel(self, spec_list, raw_item_data, major_name, middle_name, sub_name, sub_url):
        """여러 규격을 병렬로 처리하는 메서드"""
        semaphore = asyncio.Semaphore(2)  # 최대 2개 동시 처리
        
        async def process_spec_with_new_page(spec):
            async with semaphore:
                try:
                    # 새로운 페이지 생성
                    new_page = await self.context.new_page()
                    await new_page.goto(f"https://www.kpi.or.kr/www/price/{sub_url}")
                    await new_page.wait_for_load_state('networkidle', timeout=60000)
                    await asyncio.sleep(2)  # 추가 대기
                    
                    # '물가추이 보기' 탭으로 이동 (재시도 로직)
                    for retry in range(3):
                        try:
                            await new_page.get_by_role('link', name='물가추이 보기').click(timeout=15000)
                            await new_page.wait_for_selector("#ITEM_SPEC_CD", timeout=15000)
                            break
                        except Exception as e:
                            if retry == 2:
                                raise e
                            await asyncio.sleep(3)
                            await new_page.reload()
                            await new_page.wait_for_load_state('networkidle', timeout=30000)
                    
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
                    log(f"    - 병렬 처리 중 규격 '{spec['name']}' 오류: {str(e)}")
                    return []
        
        # 모든 규격을 병렬로 처리
        tasks = [process_spec_with_new_page(spec) for spec in spec_list]
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
                await page.locator('#ITEM_SPEC_CD').select_option(value=spec_value)
                await asyncio.sleep(0.5)  # 선택 후 잠시 대기
                
                # 기간 선택
                await page.locator('#DATA_YEAR_F').select_option(value=self.start_year)
                await page.locator('#DATA_MONTH_F').select_option(value=self.start_month)
                await asyncio.sleep(0.5)  # 선택 후 잠시 대기
                
                # 검색 버튼 클릭 (재시도 로직 추가)
                search_button = page.locator('form[name="sForm"] input[type="image"]')
                await search_button.click(timeout=10000)
                await page.wait_for_load_state('networkidle', timeout=15000)
                break
                
            except Exception as e:
                if attempt < max_retries - 1:
                    log(f"    - 규격 '{spec_name}' 시도 {attempt + 1} 실패, 재시도 중...")
                    await asyncio.sleep(1)
                    continue
                else:
                    log(f"    - 규격 '{spec_name}' 최종 실패: {str(e)}")
                    return

        # 데이터 테이블 파싱
        try:
            await page.wait_for_selector("#priceTrendDataArea tr", timeout=10000)
            
            # 전체 테이블 HTML을 로그로 출력해서 구조 확인
            table_html = await page.locator("#priceTrendDataArea").inner_html()
            log(f"    - 규격 '{spec_name}': 테이블 HTML 구조:\n{table_html[:500]}...")
            
            header_elements = await page.locator("#priceTrendDataArea th").all()
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
            log(f"    - 규격 '{spec_name}': 지역 = {region}, 가격 데이터 = {prices}")
            
            # 헤더 정보 추출 (테이블 구조 파악용)
            header_cells = await data_rows[0].locator("th").all()
            headers = []
            for i in range(1, len(header_cells)):  # 첫 번째 컬럼(구분) 제외
                header_text = await header_cells[i].inner_text()
                # 동그라미 숫자를 일반 숫자로 변환 (①②③④⑤⑥⑦⑧⑨⑩ 등 -> 1,2,3)
                import re
                circle_to_num = {
                    '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5',
                    '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9', '⑩': '10'
                }
                cleaned_header = header_text.strip()
                for circle, num in circle_to_num.items():
                    cleaned_header = cleaned_header.replace(circle, num)
                headers.append(cleaned_header)
            
            log(f"    - 규격 '{spec_name}': 헤더 데이터 = {headers}")
            
            price_list = []
            # 테이블 구조 분석: 헤더가 날짜이고 행이 지역별 데이터인 구조
            # 각 지역(행)에 대해 처리
            for i in range(1, len(data_rows)):  # 헤더 제외하고 모든 행 처리
                try:
                    row_tds = await data_rows[i].locator("td").all()
                    if len(row_tds) >= 2:
                        # 첫 번째 컬럼은 지역명
                        region_str = await row_tds[0].inner_text()
                        # 동그라미 숫자를 일반 숫자로 변환 (①②③ 등 -> 1,2,3)
                        import re
                        circle_to_num = {
                            '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5',
                            '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9', '⑩': '10'
                        }
                        clean_region = region_str.strip()
                        for circle, num in circle_to_num.items():
                            clean_region = clean_region.replace(circle, num)
                        
                        # 각 날짜별 가격 처리
                        for j, date_header in enumerate(headers):
                            if j + 1 < len(row_tds):
                                price_str = await row_tds[j + 1].inner_text()
                                # 가격 데이터 유효성 검증 강화
                                if price_str.strip() and price_str.strip() != '-':
                                    # 쉼표가 포함된 숫자인지 확인
                                    clean_price = price_str.strip().replace(',', '')
                                    if clean_price.isdigit() and int(clean_price) > 0:
                                        # 날짜 파싱 (YYYY. M 형태)
                                        try:
                                            year_month = date_header.strip().replace(' ', '')
                                            if '.' in year_month:
                                                year, month = year_month.split('.')
                                                date_obj = datetime(int(year), int(month), 1)
                                                price_list.append({
                                                    'date': date_obj,
                                                    'region': clean_region,
                                                    'price': price_str.strip()
                                                })
                                                log(f"    - 유효한 가격 데이터 추가: {clean_region} ({date_header}) = {price_str.strip()}")
                                        except Exception as date_parse_error:
                                            log(f"    - 날짜 파싱 오류: {date_header} - {str(date_parse_error)}")
                except Exception as row_error:
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
    is_test_mode = '--test' in sys.argv
    crawler = KpiCrawler(is_test=is_test_mode, max_concurrent=2) 
    processor = await crawler.run()
    
    # 1. 크롤링된 원본 데이터와 가공된 데이터 비교용 JSON 출력
    comparison_json = processor.get_comparison_json()
    with open('crawling_result.json', 'w', encoding='utf-8') as f:
        f.write(comparison_json)
    log("결과가 'crawling_result.json' 파일로 저장되었습니다.")

    # 2. Pandas DataFrame으로 변환
    final_df = processor.to_dataframe()
    log("Pandas DataFrame 변환 완료.")
    print("\n--- 가공된 데이터 샘플 (첫 5줄) ---")
    print(final_df.head())
    print("-----------------------------------\n")

    # 3. Supabase에 데이터 저장
    log("Supabase에 데이터 저장 중...")
    processor.save_to_supabase(final_df, 'kpi_price_data')
    log("Supabase 저장 완료!")

if __name__ == "__main__":
    # 명령행 인수로 모드 선택
    # python kpi_crawler.py --test : 테스트 모드 (테스트 타겟만 크롤링)
    # python kpi_crawler.py : 전체 크롤링 모드
    is_test_mode = '--test' in sys.argv
    
    if is_test_mode:
        log("=== 테스트 모드로 실행합니다 ===")
        log("테스트 대상: 공통자재 > 봉강 > 이형철근(이형봉강)(1), 공통자재 > 형강 > H형강")
    else:
        log("=== 전체 크롤링 모드로 실행합니다 ===")
        log("모든 대분류, 중분류, 소분류를 크롤링합니다.")
    
    asyncio.run(main())