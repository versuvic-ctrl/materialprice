#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
카테고리 추출 전용 크롤러
KPI 웹사이트에서 모든 대분류, 중분류, 소분류 카테고리 정보를 추출하여 JSON 파일로 저장
"""
import os
import asyncio
import json
import sys
import traceback
from datetime import datetime
from dotenv import load_dotenv
from playwright.async_api import async_playwright
# 현재 디렉터리를 sys.path에 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)
# 환경 변수 로드
load_dotenv("../../.env.local")
# log 함수 정의
try:
    from data_processor import log
except ImportError:
    def log(message, level="INFO"):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
log(f"KPI_USERNAME: {os.environ.get('KPI_USERNAME')}", "DEBUG")
log(f"KPI_PASSWORD: {os.environ.get('KPI_PASSWORD')}", "DEBUG")
class CategoryExtractor:
    def __init__(self):
        self.base_url = "https://www.kpi.or.kr"
        self.categories = {}
        self.auth_file = os.path.join(current_dir, "auth.json")
        self.browser = None
        self.context = None
        self.categories_lock = asyncio.Lock()
        self.max_concurrent_pages = 3  # 동시 페이지 수 제한 (서버 부하 고려)
        self.page_semaphore = asyncio.Semaphore(self.max_concurrent_pages)
    async def run(self):
        """메인 실행 함수"""
        try:
            async with async_playwright() as p:
                self.browser = await p.chromium.launch(
                    headless=False,  # 브라우저를 볼 수 있도록 변경
                    args=[
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor',
                        '--window-size=1920,1080'
                    ]
                )
                # Load existing authentication state if available
                if os.path.exists(self.auth_file):
                    log("기존 인증 상태를 로드합니다.")
                    self.context = await self.browser.new_context(
                        storage_state=self.auth_file)
                else:
                    log("새로운 브라우저 컨텍스트를 생성합니다.")
                    self.context = await self.browser.new_context()
                self.page = await self.context.new_page()
                log("카테고리 추출 작업을 시작합니다.")
                # 로그인
                log("로그인 시작")
                if not await self._login(self.context):
                    log("로그인 실패", "ERROR")
                    return False
                log("로그인 성공")
                # 카테고리 페이지로 이동
                log("카테고리 페이지 이동 시작")
                if not await self._navigate_to_category():
                    log("카테고리 페이지 이동 실패", "ERROR")
                    return False
                log("카테고리 페이지 이동 성공")
                # 카테고리 크롤링 (병렬 방식)
                log("카테고리 크롤링 시작")
                if not await self._crawl_categories_parallel():
                    log("카테고리 크롤링 실패", "ERROR")
                    return False
                log("카테고리 크롤링 성공")
                # JSON 저장
                log("JSON 파일 저장")
                await self.save_to_json()
                log("JSON 파일 저장 완료")
                await self.browser.close()
                return True
        except Exception as e:
            log(f"크롤링 중 오류 발생: {str(e)}", "ERROR")
            log(f"상세 오류: {traceback.format_exc()}", "ERROR")
            if self.browser:
                try:
                    await self.browser.close()
                except:
                    pass
            return False
    async def _login(self, context):
        """로그인 페이지로 이동하여 로그인 수행 (재시도 로직 포함)"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                log(f"로그인 시도 {attempt + 1}/{max_retries}")
                await self.page.goto(f"{self.base_url}/www/member/login.asp")
                await self.page.wait_for_load_state('networkidle', timeout=45000)
                await asyncio.sleep(2)
                # Check if already logged in (e.g., redirected away from login page)
                if "login.asp" not in self.page.url:
                    log("기존 로그인 세션이 유효합니다.", "INFO")
                    # Update authentication state in case it's an old valid session
                    await context.storage_state(path=self.auth_file)
                    log("인증 상태를 업데이트했습니다.")
                    return True
                log("로그인 세션이 없거나 만료되었습니다. 새로 로그인합니다.")
                username = os.environ.get("KPI_USERNAME")
                password = os.environ.get("KPI_PASSWORD")
                if not username or not password:
                    raise ValueError(".env.local 파일에 KPI_USERNAME과 KPI_PASSWORD를 설정해야 합니다.")
                # 기존 입력 필드 내용 지우기
                await self.page.locator("#user_id").clear()
                await self.page.locator("#user_pw").clear()
                await asyncio.sleep(1)
                # 로그인 정보 입력
                await self.page.locator("#user_id").fill(username)
                await asyncio.sleep(1)
                await self.page.locator("#user_pw").fill(password)
                await asyncio.sleep(1)
                await self.page.locator("#sendLogin").click()
                # 로그인 완료 대기 및 성공 여부 확인
                await self.page.wait_for_load_state('networkidle', timeout=45000)
                await asyncio.sleep(3)
                if "login.asp" not in self.page.url:
                    log("로그인 성공", "SUCCESS")
                    await context.storage_state(path=self.auth_file)
                    log("인증 상태를 저장했습니다.")
                    return True
                else:
                    log(f"로그인 실패: 로그인 페이지에 머물러 있습니다. (시도 {attempt + 1}/{max_retries})", "WARNING")
                    if attempt < max_retries - 1:
                        log(f"5초 후 재시도합니다...", "INFO")
                        await asyncio.sleep(5)
                        # 기존 auth.json 삭제하고 새 브라우저 컨텍스트 생성
                        if os.path.exists(self.auth_file):
                            os.remove(self.auth_file)
                            log("기존 인증 파일을 삭제했습니다.")
                    else:
                        log("로그인 최대 재시도 횟수 초과", "ERROR")
                        return False
            except Exception as e:
                log(f"로그인 시도 {attempt + 1} 중 오류 발생: {str(e)}", "ERROR")
                if attempt < max_retries - 1:
                    log(f"5초 후 재시도합니다...", "INFO")
                    await asyncio.sleep(5)
                else:
                    log("로그인 최대 재시도 횟수 초과", "ERROR")
                    return False
        return False
    async def _navigate_to_category(self):
        """카테고리 페이지로 이동 및 초기 설정 (재시도 로직 포함)"""
        try:
            log("종합물가정보 카테고리 페이지로 이동합니다.")
            max_retries = 3
            retry_count = 0
            while retry_count < max_retries:
                try:
                    await self.page.goto(
                        f"{self.base_url}/www/price/category.asp",
                        timeout=90000,
                        wait_until="networkidle"
                    )
                    await self.page.wait_for_load_state('networkidle', timeout=60000)
                    await self._close_popups()
                    # Right Quick 메뉴 숨기기
                    try:
                        close_button = self.page.locator("#right_quick .q_cl")
                        if await close_button.is_visible():
                            await close_button.click()
                            log("Right Quick 메뉴를 숨겼습니다.")
                    except Exception as e:
                        log(f"Right Quick 메뉴 숨기기 실패: {e}")
                    log("카테고리 페이지 이동 완료", "SUCCESS")
                    return True
                except Exception as e:
                    retry_count += 1
                    log(f"카테고리 페이지 이동 실패 (시도 {retry_count}/{max_retries}): {e}", "WARNING")
                    if retry_count < max_retries:
                        wait_time = retry_count * 5
                        log(f"{wait_time}초 후 재시도합니다...", "INFO")
                        await asyncio.sleep(wait_time)
                    else:
                        log("카테고리 페이지 이동 최대 재시도 횟수 초과", "ERROR")
                        return False
            return False
        except Exception as e:
            log(f"카테고리 페이지 이동 중 오류 발생: {str(e)}", "ERROR")
            return False
    async def _close_popups(self):
        """페이지의 모든 팝업을 닫는 메서드"""
        try:
            popup_close_selectors = [
                ".pop-btn-close",
                ".btnClosepop",
                "#popupNotice .pop-btn-close",
                ".ui-popup .pop-btn-close",
                "button[class*='close']",
                "a[class*='close']"
            ]
            for selector in popup_close_selectors:
                try:
                    popup_close = self.page.locator(selector)
                    if await popup_close.count() > 0:
                        for i in range(await popup_close.count()):
                            element = popup_close.nth(i)
                            if await element.is_visible():
                                await element.click(timeout=3000)
                                log(f"팝업 닫기 성공: {selector}")
                                await self.page.wait_for_timeout(500)
                except Exception:
                    continue
            await self.page.keyboard.press('Escape')
            await self.page.wait_for_timeout(500)
            log("팝업 닫기 처리 완료")
        except Exception as e:
            log(f"팝업 닫기 처리 중 오류: {e}")
    async def _crawl_categories(self):
        """대분류 -> 중분류 -> 소분류 순차적으로 크롤링"""
        try:
            major_selector = '#left_menu_kpi > ul.panel'
            major_categories = await self.page.locator(major_selector).first.locator('li.file-item > a').all()
            major_links = []
            for cat in major_categories:
                text = await cat.inner_text()
                href = await cat.get_attribute('href')
                major_links.append({'name': text, 'url': f"{self.base_url}{href}"})
            log(f"발견된 대분류 개수: {len(major_links)}")
            for major in major_links:
                log(f"대분류 '{major['name']}' 크롤링 시작...")
                await self.page.goto(major['url'])
                log("페이지 로딩을 위한 기본 대기 시간 적용 (10초)")
                await self.page.wait_for_timeout(10000)
                # openSub() 버튼 클릭하여 모든 중분류와 소분류를 한번에 펼치기
                open_sub_selector = 'a[href="javascript:openSub();"]'
                open_sub_button = self.page.locator(open_sub_selector)
                if await open_sub_button.count() > 0:
                    log("openSub() 버튼을 클릭하여 모든 분류를 펼칩니다.")
                    await open_sub_button.click()
                    await self.page.wait_for_timeout(5000)
                    try:
                        await self.page.wait_for_selector('.part-ttl > a', state='visible', timeout=15000)
                        log("중분류 요소들이 화면에 완전히 로드되었습니다.")
                    except Exception as e:
                        log(f"중분류 요소 가시성 대기 실패: {e}", "WARNING")
                # 중분류 정보를 미리 수집
                middle_selector = '.part-ttl > a'
                middle_categories_elements = await self.page.locator(middle_selector).all()
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
                            log(f"  발견된 중분류: '{middle_name}'")
                    except Exception as e:
                        log(f"  중분류 {i + 1} 정보 수집 중 오류: {str(e)}")
                        continue
                # 대분류 데이터 초기화
                self.categories[major['name']] = {}
                # 각 중분류를 순차적으로 처리 (로그인 세션 유지를 위해)
                for middle_info in middle_categories_info:
                    await self._crawl_middle_category_sequential(major['name'], middle_info)
            log(f"대분류 크롤링 완료")
            return True
        except Exception as e:
            log(f"카테고리 크롤링 중 오류 발생: {str(e)}", "ERROR")
            return False
    async def _crawl_categories_parallel(self):
        """병렬 방식으로 대분류 -> 중분류 -> 소분류 크롤링"""
        try:
            major_selector = '#left_menu_kpi > ul.panel'
            major_categories = await self.page.locator(major_selector).first.locator('li.file-item > a').all()
            major_links = []
            for cat in major_categories:
                text = await cat.inner_text()
                href = await cat.get_attribute('href')
                major_links.append({'name': text, 'url': f"{self.base_url}{href}"})
            log(f"대분류 {len(major_links)}개 발견")
            # 대분류를 순차적으로 처리 (로그인 세션 유지)
            for major in major_links:
                log(f"대분류 '{major['name']}' 처리 시작")
                await self._process_major_category_parallel(major)
            return True
        except Exception as e:
            log(f"병렬 크롤링 중 오류: {str(e)}", "ERROR")
            return False
    async def _process_major_category_parallel(self, major):
        """대분류를 병렬로 처리"""
        try:
            await self.page.goto(major['url'])
            await self.page.wait_for_timeout(5000)
            # openSub() 버튼 클릭
            open_sub_button = self.page.locator('a[href="javascript:openSub();"]')
            if await open_sub_button.count() > 0:
                await open_sub_button.click()
                await self.page.wait_for_timeout(3000)
            # 중분류 정보 수집
            middle_categories_info = await self._collect_middle_categories()
            log(f"  중분류 {len(middle_categories_info)}개 발견")
            # 대분류 데이터 초기화
            async with self.categories_lock:
                self.categories[major['name']] = {}
            # 중분류를 병렬로 처리 (제한된 동시 수행)
            semaphore = asyncio.Semaphore(2)  # 중분류 동시 처리 수 제한
            tasks = []
            for middle_info in middle_categories_info:
                task = self._process_middle_category_with_semaphore(
                    semaphore, major['name'], middle_info)
                tasks.append(task)
            await asyncio.gather(*tasks, return_exceptions=True)
        except Exception as e:
            log(f"대분류 '{major['name']}' 처리 중 오류: {str(e)}", "ERROR")
    async def _collect_middle_categories(self):
        """중분류 정보 수집"""
        middle_categories_info = []
        try:
            middle_selector = '.part-ttl > a'
            middle_elements = await self.page.locator(middle_selector).all()
            for element in middle_elements:
                try:
                    middle_name = await element.inner_text()
                    middle_href = await element.get_attribute('href')
                    if middle_href and 'CATE_CD=' in middle_href:
                        middle_categories_info.append({
                            'name': middle_name,
                            'href': middle_href
                        })
                except Exception:
                    continue
        except Exception as e:
            log(f"중분류 수집 오류: {e}", "ERROR")
        return middle_categories_info
    async def _process_middle_category_with_semaphore(self, semaphore, major_name, middle_info):
        """세마포어를 사용한 중분류 처리"""
        async with semaphore:
            await self._process_middle_category_parallel(major_name, middle_info)
    async def _process_middle_category_parallel(self, major_name, middle_info):
        """병렬로 중분류 처리"""
        middle_name = middle_info['name']
        try:
            # 새 페이지 생성 (로그인 세션 유지)
            page = await self.context.new_page()
            try:
                middle_url = f"{self.base_url}/www/price/{middle_info['href']}"
                await page.goto(middle_url)
                await page.wait_for_load_state('networkidle')
                await page.wait_for_timeout(1000)
                # 소분류 정보 수집
                sub_categories_info = await self._collect_sub_categories(page)
                log(f"    {middle_name}: 소분류 {len(sub_categories_info)}개")
                # 중분류 데이터 초기화
                async with self.categories_lock:
                    if major_name not in self.categories:
                        self.categories[major_name] = {}
                    self.categories[major_name][middle_name] = {}
                # 소분류를 병렬로 처리
                sub_tasks = []
                for sub_category in sub_categories_info:
                    task = self._process_sub_category_parallel(
                        major_name, middle_name, sub_category)
                    sub_tasks.append(task)
                if sub_tasks:
                    results = await asyncio.gather(*sub_tasks, return_exceptions=True)
                    # 결과 저장
                    for i, result in enumerate(results):
                        if isinstance(result, dict) and i < len(sub_categories_info):
                            sub_name = sub_categories_info[i]['name']
                            async with self.categories_lock:
                                self.categories[major_name][middle_name][sub_name] = result
            finally:
                await page.close()
        except Exception as e:
            log(f"    {middle_name} 오류: {str(e)}", "ERROR")
    async def _collect_sub_categories(self, page):
        """소분류 정보 수집"""
        sub_categories_info = []
        try:
            detail_selector = 'a[href*="detail.asp?CATE_CD="]'
            all_links = await page.locator(detail_selector).all()
            for link in all_links:
                try:
                    parent_li = link.locator('xpath=..')
                    sub_name = await parent_li.get_attribute('title')
                    sub_href = await link.get_attribute('href')
                    if sub_href and sub_name and sub_name.strip():
                        import re
                        match = re.search(r'CATE_CD=([^&]+)', sub_href)
                        if match:
                            cate_cd = match.group(1)
                            sub_categories_info.append({
                                'name': sub_name.strip(),
                                'code': cate_cd,
                                'href': sub_href
                            })
                except Exception:
                    continue
        except Exception as e:
            log(f"소분류 수집 오류: {e}", "ERROR")
        return sub_categories_info
    async def _process_sub_category_parallel(self, major_name, middle_name, sub_category):
        """병렬로 소분류 처리"""
        async with self.page_semaphore:
            page = await self.context.new_page()
            try:
                return await self._extract_specs_and_units_optimized(page, sub_category)
            finally:
                await page.close()
    async def _extract_specs_and_units_optimized(self, page, sub_category):
        """최적화된 방식으로 Spec과 Unit 추출 (매칭 포함)"""
        try:
            # 소분류 페이지로 이동
            sub_url = f"https://www.kpi.or.kr/www/price/detail.asp?CATE_CD={sub_category['code']}"
            if len(sub_category['code']) >= 4:
                item_cd = sub_category['code'][-4:]
                sub_url += f"&ITEM_CD={item_cd}"
            await page.goto(sub_url, wait_until='networkidle')
            await page.wait_for_timeout(1000)
            # 1. 물가정보 보기 탭에서 데이터 추출
            price_info_data = await self._extract_price_info_optimized(page)
            # 2. 물가추이 보기 탭에서 Specification 추출
            specifications_data = await self._extract_specifications_optimized(page)
            # 3. Specification과 Unit 매칭
            matched_data = self._match_specifications_with_units(
                price_info_data, specifications_data)
            if matched_data:
                unit_count = len([item for item in matched_data if item.get('unit')])
                spec_count = len(matched_data)
                log(f"      {sub_category['name']}: {spec_count}개 Spec, {unit_count}개 Unit 매칭")
            return {
                "specifications_with_units": matched_data,
                "raw_price_info": price_info_data,
                "raw_specifications": specifications_data
            }
        except Exception as e:
            log(f"      {sub_category['name']} 추출 오류: {str(e)}", "ERROR")
            return {
                "specifications_with_units": [],
                "raw_price_info": {},
                "raw_specifications": []
            }
    async def _extract_price_info_optimized(self, page):
        """최적화된 물가정보 추출"""
        price_info = {
            "products": []  # [{"name": "", "spec": "", "unit": ""}]
        }
        try:
            # 테이블에서 데이터 추출
            table = page.locator('div.detl-wro.price-tb table').first
            if await table.count() > 0:
                rows = table.locator('tr')
                row_count = await rows.count()
                # 헤더 행 건너뛰기
                start_idx = 1 if row_count > 0 and await rows.nth(0).locator('th').count() > 0 else 0
                for row_idx in range(start_idx, row_count):
                    try:
                        row = rows.nth(row_idx)
                        cells = row.locator('td')
                        cell_count = await cells.count()
                        if cell_count >= 3:
                            # 품명
                            name_cell = cells.nth(0)
                            name_link = name_cell.locator('a[name]')
                            name = await name_link.text_content() if await name_link.count() > 0 else await name_cell.text_content()
                            name = name.strip() if name else ""
                            # 규격
                            spec = await cells.nth(1).text_content()
                            spec = spec.strip() if spec else ""
                            # 단위
                            unit_cell = cells.nth(2)
                            unit_link = unit_cell.locator('a u')
                            unit = await unit_link.text_content() if await unit_link.count() > 0 else await unit_cell.text_content()
                            unit = unit.strip() if unit else ""
                            if name and spec and unit:
                                price_info["products"].append({
                                    "name": name,
                                    "spec": spec,
                                    "unit": unit
                                })
                    except Exception:
                        continue
        except Exception as e:
            log(f"        물가정보 추출 오류: {e}", "WARNING")
        return price_info
    async def _extract_specifications_optimized(self, page):
        """최적화된 Specification 추출"""
        specifications = []
        try:
            # 물가추이 보기 탭 클릭
            trend_selectors = [
                'a[href*="detail_change.asp"] span:has-text("물가추이 보기")',
                'a[href*="detail_change.asp"]'
            ]
            trend_clicked = False
            for selector in trend_selectors:
                try:
                    element = page.locator(selector).first
                    if await element.count() > 0:
                        await element.click()
                        await page.wait_for_load_state('networkidle')
                        await page.wait_for_timeout(2000)
                        trend_clicked = True
                        break
                except Exception:
                    continue
            if trend_clicked:
                # Specification 드롭다운에서 데이터 추출
                select_element = page.locator('select[name="ITEM_SPEC_CD"]')
                if await select_element.count() > 0:
                    options = await select_element.locator('option').all()
                    for option in options:
                        try:
                            value = await option.get_attribute('value')
                            text = await option.text_content()
                            if value and text and value.strip() and text.strip():
                                # 텍스트에서 품명과 규격 분리
                                parts = text.strip().split(' - ')
                                if len(parts) >= 2:
                                    product_name = parts[0].strip()
                                    specification = parts[1].strip()
                                else:
                                    product_name = text.strip()
                                    specification = text.strip()
                                specifications.append({
                                    'value': value.strip(),
                                    'product_name': product_name,
                                    'specification': specification,
                                    'full_text': text.strip()
                                })
                        except Exception:
                            continue
        except Exception as e:
            log(f"        Specification 추출 오류: {e}", "WARNING")
        return specifications
    def _match_specifications_with_units(self, price_info_data, specifications_data):
        """개선된 Specification과 Unit 매칭 로직"""
        matched_results = []
        try:
            products = price_info_data.get("products", [])
            for spec_item in specifications_data:
                specification_name = spec_item.get('product_name', '')
                spec_detail = spec_item.get('specification', '')
                spec_full = spec_item.get('full_text', '')
                # 가장 적합한 단위 찾기
                best_unit = None
                best_score = 0
                for product in products:
                    # 여러 매칭 전략 사용
                    score = 0
                    # 1. 품명 매칭
                    if specification_name and product['name']:
                        name_score = self._calculate_text_similarity(specification_name, product['name'])
                        score += name_score * 0.4
                    # 2. 규격 매칭
                    if spec_detail and product['spec']:
                        spec_score = self._calculate_text_similarity(spec_detail, product['spec'])
                        score += spec_score * 0.6
                    # 3. 전체 텍스트 매칭
                    if spec_full:
                        combined_product = f"{product['name']} {product['spec']}"
                        full_score = self._calculate_text_similarity(spec_full, combined_product)
                        score += full_score * 0.3
                    if score > best_score:
                        best_score = score
                        best_unit = product['unit']
                # 결과 추가 (임계값 0.2 이상)
                matched_results.append({
                    'specification': spec_detail,
                    'product_name': specification_name,
                    'full_specification': spec_full,
                    'unit': best_unit if best_score > 0.2 else None,
                    'matching_confidence': round(best_score, 3)
                })
        except Exception as e:
            log(f"        매칭 오류: {e}", "WARNING")
        return matched_results
    def _calculate_text_similarity(self, text1, text2):
        """텍스트 유사도 계산 (개선된 버전)"""
        try:
            if not text1 or not text2:
                return 0.0
            # 소문자 변환 및 특수문자 제거
            import re
            text1_clean = re.sub(r'[^\w\s]', '', text1.lower())
            text2_clean = re.sub(r'[^\w\s]', '', text2.lower())
            words1 = set(text1_clean.split())
            words2 = set(text2_clean.split())
            if not words1 or not words2:
                return 0.0
            # Jaccard 유사도 계산
            intersection = words1.intersection(words2)
            union = words1.union(words2)
            jaccard_score = len(intersection) / len(union) if union else 0.0
            # 추가: 대표 단어 매칭 보너스
            important_words = ['D10', 'D13', 'D16', 'D19', 'D22', 'D25', 'D29', 'D32', 'SD', 'SS']
            bonus = 0
            for word in important_words:
                if word.lower() in text1.lower() and word.lower() in text2.lower():
                    bonus += 0.1
            return min(jaccard_score + bonus, 1.0)
        except Exception:
            return 0.0
        """
        중분류를 단일 페이지에서 순차적으로 처리 (로그인 세션 유지)
        """
        middle_name = middle_info['name']
        middle_href = middle_info['href']
        try:
            # 단일 페이지에서 중분류 페이지로 이동
            middle_url = f"{self.base_url}/www/price/{middle_href}"
            log(f"  중분류 '{middle_name}' 페이지로 이동: {middle_url}")
            await self.page.goto(middle_url)
            await self.page.wait_for_load_state('networkidle')
            await self.page.wait_for_timeout(2000)
            # 소분류 정보 수집
            sub_categories_info = []
            try:
                detail_selector = 'a[href*="detail.asp?CATE_CD="]'
                all_links = await self.page.locator(detail_selector).all()
                for link in all_links:
                    try:
                        parent_li = link.locator('xpath=..')
                        sub_name = await parent_li.get_attribute('title')
                        sub_href = await link.get_attribute('href')
                        if sub_href and sub_name and sub_name.strip():
                            # CATE_CD 추출
                            import re
                            match = re.search(r'CATE_CD=([^&]+)', sub_href)
                            if match:
                                cate_cd = match.group(1)
                                sub_categories_info.append({
                                    'name': sub_name.strip(), 
                                    'code': cate_cd,
                                    'href': sub_href
                                })
                    except Exception as e:
                        log(f"    소분류 정보 수집 중 오류: {str(e)}", "WARNING")
                log(f"  '{middle_name}'에서 발견된 소분류 개수: {len(sub_categories_info)}")
                # 카테고리 데이터 초기화
                if major_name not in self.categories:
                    self.categories[major_name] = {}
                if middle_name not in self.categories[major_name]:
                    self.categories[major_name][middle_name] = {}
                # 소분류를 순차적으로 처리
                for sub_category in sub_categories_info:
                    try:
                        specs_and_units = await self._get_specs_and_units_sequential(sub_category)
                        self.categories[major_name][middle_name][sub_category['name']] = specs_and_units
                        # 요청 간 간격 추가
                        await asyncio.sleep(1)
                    except Exception as e:
                        log(f"    소분류 '{sub_category['name']}' 처리 중 오류: {e}", "ERROR")
                        self.categories[major_name][middle_name][sub_category['name']] = {}
            except Exception as e:
                log(f"  중분류 '{middle_name}' 소분류 수집 중 오류: {e}", "ERROR")
        except Exception as e:
            log(f"중분류 '{middle_name}' 크롤링 중 오류 발생: {str(e)}", "ERROR")
    async def _get_specs_and_units_sequential(self, sub_category):
        """
        단일 페이지에서 소분류 페이지로 이동하여 규격과 단위 추출
        """
        # 첫 번째 소분류 디버깅 플래그 추가
        if not hasattr(self, '_first_subcategory_processed'):
            self._first_subcategory_processed = True
            self._debug_first = True
        else:
            self._debug_first = False
        extracted_specs_units = {}
        try:
            # 소분류 페이지로 이동 (올바른 URL 구조 사용)
            # detail.asp?CATE_CD=...&ITEM_CD=... 형태로 사용
            sub_url = f"https://www.kpi.or.kr/www/price/detail.asp?CATE_CD={sub_category['code']}"
            # ITEM_CD는 보통 마지막 4자리를 사용하는 경우가 많음
            if len(sub_category['code']) >= 4:
                item_cd = sub_category['code'][-4:]
                sub_url += f"&ITEM_CD={item_cd}"
            await self.page.goto(sub_url, wait_until='networkidle')
            log(f"    소분류 '{sub_category['name']}' 페이지로 이동: {sub_url}")
            # 첫 번째 소분류에서 디버깅 정보 출력 (제거됨)
            # if sub_category['code'] == '10100104': ...
            # 첫 번째 소분류에서 페이지 전체 구조 분석
            if self._debug_first:
                log(f"      디버깅: 현재 페이지 URL: {self.page.url}")
                # 페이지의 모든 HTML 확인 (일부만)
                page_content = await self.page.content()
                log(f"      디버깅: 페이지 HTML 길이: {len(page_content)}")
                # "물가정보 보기" 텍스트가 있는지 확인
                if '물가정보 보기' in page_content:
                    log(f"      디버깅: 페이지에 '물가정보 보기' 텍스트 발견")
                    # "물가정보 보기"가 포함된 HTML 부분 추출
                    import re
                    pattern = r'.{0,200}물가정보 보기.{0,200}'
                    matches = re.findall(pattern, page_content, re.DOTALL)
                    for i, match in enumerate(matches[:3]):  # 최대 3개만
                        log(f"      디버깅: '물가정보 보기' 주변 HTML {i+1}: {match}")
                else:
                    log(f"      디버깅: 페이지에 '물가정보 보기' 텍스트 없음")
                # 모든 a 태그 확인
                all_links = await self.page.locator('a').all()
                log(f"      디버깅: 페이지의 전체 a 태그 수: {len(all_links)}")
                # span 태그 확인
                all_spans = await self.page.locator('span').all()
                log(f"      디버깅: 페이지의 전체 span 태그 수: {len(all_spans)}")
                # 탭과 관련된 요소들 찾기
                possible_tab_elements = await self.page.locator('*').filter(has_text='물가정보').all()
                if possible_tab_elements:
                    log(f"      디버깅: '물가정보' 텍스트를 포함한 요소 {len(possible_tab_elements)}개 발견")
                    for i, elem in enumerate(possible_tab_elements[:5]):  # 최대 5개만
                        tag_name = await elem.evaluate('element => element.tagName')
                        outer_html = await elem.evaluate('element => element.outerHTML')
                        log(f"      디버깅: 물가정보 요소 {i+1} ({tag_name}): {outer_html[:200]}")
                # 테이블 관련 요소들 확인
                all_tables = await self.page.locator('table').count()
                log(f"      디버깅: 페이지의 전체 테이블 수: {all_tables}")
                # div.detl-wro 확인
                detl_wro_count = await self.page.locator('div.detl-wro').count()
                log(f"      디버깅: 'div.detl-wro' 요소 수: {detl_wro_count}")
                # div.price-tb 확인
                price_tb_count = await self.page.locator('div.price-tb').count()
                log(f"      디버깅: 'div.price-tb' 요소 수: {price_tb_count}")
            # "물가정보 보기" 탭에서 품명, 규격, 단위 정보 추출
            price_info_data = await self._extract_price_info()
            # "물가추이 보기" 탭에서 Specification 정보 추출
            specification_data = await self._extract_specifications()
            # 두 데이터를 합쳐서 최종 결과 생성
            extracted_specs_units = {
                "specs": price_info_data.get("specs", []),
                "units": price_info_data.get("units", []), 
                "product_names": price_info_data.get("product_names", []),
                "specifications": specification_data  # 새로운 specification 데이터
            }
            log(f"      소분류 '{sub_category['name']}' 추출 완료 - 품명: {len(extracted_specs_units['product_names'])}개, 규격: {len(extracted_specs_units['specs'])}개, 단위: {len(extracted_specs_units['units'])}개, Specifications: {len(extracted_specs_units['specifications'])}개")
        except Exception as e:
            log(f"      소분류 '{sub_category['name']}' 처리 중 오류: {str(e)}", "ERROR")
            extracted_specs_units = {
                "specs": [],
                "units": [], 
                "product_names": [],
                "specifications": []
            }
        return extracted_specs_units
    async def _extract_price_info(self):
        """물가정보 보기 탭에서 품명, 규격, 단위 정보 추출"""
        specs = set()
        units = set()
        product_names = set()
        try:
            # "물가정보 보기" 탭 클릭 시도
            tab_selectors = [
                'span:has-text("물가정보 보기")',
                'a:has(span:has-text("물가정보 보기"))',
                'li:has-text("물가정보 보기")',
                '.itb-act span:has-text("물가정보 보기")',
                'li.itb-act span'
            ]
            tab_clicked = False
            for selector in tab_selectors:
                try:
                    tab_element = self.page.locator(selector).first
                    if await tab_element.count() > 0:
                        await tab_element.click()
                        await self.page.wait_for_load_state('networkidle')
                        await self.page.wait_for_timeout(2000)
                        tab_clicked = True
                        log(f"      '물가정보 보기' 탭 클릭 성공: {selector}")
                        break
                except Exception as e:
                    continue
            if not tab_clicked:
                log(f"      '물가정보 보기' 탭을 찾을 수 없습니다. 현재 페이지에서 데이터 추출을 시도합니다.", "INFO")
            # 테이블에서 데이터 추출 (탭 클릭 여부와 관계없이)
            table = self.page.locator('div.detl-wro.price-tb table').first
            if await table.count() > 0:
                log(f"      물가정보 테이블 발견")
                rows = table.locator('tr')
                row_count = await rows.count()
                # 헤더 행 확인
                header_row_index = 0
                if row_count > 0:
                    first_row = rows.nth(0)
                    th_count = await first_row.locator('th').count()
                    if th_count > 0:
                        header_row_index = 1
                # 데이터 행에서 정보 추출
                for row_idx in range(header_row_index, row_count):
                    try:
                        row = rows.nth(row_idx)
                        cells = row.locator('td')
                        cell_count = await cells.count()
                        if cell_count >= 3:
                            # 품명 추출
                            name_cell = cells.nth(0)
                            name_link = name_cell.locator('a[name]')
                            if await name_link.count() > 0:
                                name = await name_link.text_content()
                            else:
                                name = await name_cell.text_content()
                            name = name.strip() if name else ""
                            # 규격 추출
                            spec_cell = cells.nth(1)
                            spec = await spec_cell.text_content()
                            spec = spec.strip() if spec else ""
                            # 단위 추출
                            unit_cell = cells.nth(2)
                            unit_link = unit_cell.locator('a u')
                            if await unit_link.count() > 0:
                                unit = await unit_link.text_content()
                            else:
                                unit = await unit_cell.text_content()
                            unit = unit.strip() if unit else ""
                            if name and spec and unit:
                                product_names.add(name)
                                specs.add(spec)
                                units.add(unit)
                                if len(product_names) == 1:
                                    log(f"      첫 번째 항목: 품명={name}, 규격={spec}, 단위={unit}")
                    except Exception as e:
                        log(f"      행 {row_idx} 처리 중 오류: {e}")
                        continue
                log(f"      추출 완료: 품명 {len(product_names)}개, 규격 {len(specs)}개, 단위 {len(units)}개")
            else:
                log(f"      물가정보 테이블을 찾을 수 없습니다")
        except Exception as e:
            log(f"      물가정보 추출 중 오류: {e}", "WARNING")
        return {
            "specs": list(specs),
            "units": list(units), 
            "product_names": list(product_names)
        }
    async def _extract_specifications(self):
        """물가추이 보기 탭에서 Specification 정보 추출"""
        specifications = []
        try:
            # "물가추이 보기" 탭 클릭
            trend_selectors = [
                'a[href*="detail_change.asp"] span:has-text("물가추이 보기")',
                'a span:has-text("물가추이 보기")',
                'span:has-text("물가추이 보기")',
                'a:has(span:has-text("물가추이 보기"))',
                'li:has-text("물가추이 보기")',
                'a[href*="detail_change.asp"]'
            ]
            trend_tab_clicked = False
            for selector in trend_selectors:
                try:
                    trend_element = self.page.locator(selector).first
                    if await trend_element.count() > 0:
                        await trend_element.click()
                        await self.page.wait_for_load_state('networkidle')
                        await self.page.wait_for_timeout(3000)
                        trend_tab_clicked = True
                        log(f"      '물가추이 보기' 탭 클릭 성공: {selector}")
                        break
                except Exception as e:
                    continue
            if not trend_tab_clicked:
                log(f"      '물가추이 보기' 탭을 찾을 수 없습니다.", "WARNING")
                return []
            # 드롭다운에서 Specification 옵션 추출
            dropdown_selectors = [
                'select[name="ITEM_SPEC_CD"] option',
                'select option',
                '.select-box option',
                'option'
            ]
            for dropdown_selector in dropdown_selectors:
                try:
                    options = await self.page.locator(dropdown_selector).all()
                    if len(options) > 1:
                        log(f"      드롭다운에서 {len(options)}개 옵션 발견")
                        for option in options:
                            try:
                                value = await option.get_attribute('value')
                                text = await option.text_content()
                                if value and text and value.strip() and text.strip() and \
                                   not text.strip().startswith('선택') and not text.strip().startswith('--'):
                                    specifications.append({
                                        'value': value.strip(),
                                        'text': text.strip()
                                    })
                            except Exception as e:
                                continue
                        if specifications:
                            log(f"      {len(specifications)}개 Specification 추출 완료")
                            break
                except Exception as e:
                    continue
            if not specifications:
                log(f"      드롭다운에서 Specification을 찾을 수 없습니다.", "WARNING")
        except Exception as e:
            log(f"      Specification 추출 중 오류: {e}", "WARNING")
    async def _extract_specifications(self):
        """물가추이 보기 탭에서 Specification 정보 추출"""
        specifications = []
        try:
            # "물가추이 보기" 탭 클릭 (사용자 제공 HTML 구조 기반)
            trend_selectors = [
                'a[href*="detail_change.asp"] span:has-text("물가추이 보기")',
                'a[href*="detail_change.asp"]',
                'span:has-text("물가추이 보기")',
                'a:has(span:has-text("물가추이 보기"))'
            ]
            trend_tab_clicked = False
            for selector in trend_selectors:
                try:
                    trend_element = self.page.locator(selector).first
                    if await trend_element.count() > 0:
                        await trend_element.click()
                        await self.page.wait_for_load_state('networkidle')
                        await self.page.wait_for_timeout(3000)
                        trend_tab_clicked = True
                        log(f"      '물가추이 보기' 탭 클릭 성공: {selector}")
                        break
                except Exception as e:
                    continue
            if not trend_tab_clicked:
                log(f"      '물가추이 보기' 탭을 찾을 수 없습니다.", "WARNING")
                return []
            # 사용자가 제공한 정확한 선택자로 Specification 드롭다운 찾기
            try:
                select_element = self.page.locator('select[name="ITEM_SPEC_CD"]')
                if await select_element.count() > 0:
                    options = await select_element.locator('option').all()
                    log(f"      드롭다운에서 {len(options)}개 옵션 발견")
                    for option in options:
                        try:
                            value = await option.get_attribute('value')
                            text = await option.text_content()
                            if value and text and value.strip() and text.strip():
                                # 텍스트에서 품명과 규격 분리
                                # 예: "고장력철근(하이바)(SD 400) -  D10㎎, 0.560"
                                parts = text.strip().split(' - ')
                                if len(parts) >= 2:
                                    product_name = parts[0].strip()
                                    specification = parts[1].strip()
                                else:
                                    product_name = text.strip()
                                    specification = text.strip()
                                specifications.append({
                                    'value': value.strip(),
                                    'product_name': product_name,
                                    'specification': specification,
                                    'full_text': text.strip()
                                })
                        except Exception as e:
                            continue
                    log(f"      {len(specifications)}개 Specification 추출 완료")
                else:
                    log(f"      Specification 드롭다운을 찾을 수 없습니다.", "WARNING")
            except Exception as e:
                log(f"      드롭다운 처리 중 오류: {e}", "WARNING")
        except Exception as e:
            log(f"      Specification 추출 중 오류: {e}", "WARNING")
        return specifications
    def _calculate_matching_score(self, spec_text, combined_text):
        """Specification과 품명+규격 텍스트 간의 매칭 점수 계산"""
        try:
            # 간단한 키워드 기반 매칭 (실제로는 더 정교한 로직 필요)
            spec_words = set(spec_text.lower().split())
            combined_words = set(combined_text.lower().split())
            if not spec_words or not combined_words:
                return 0.0
            # 교집합 비율 계산
            intersection = spec_words.intersection(combined_words)
            union = spec_words.union(combined_words)
            return len(intersection) / len(union) if union else 0.0
        except Exception:
            return 0.0
    async def save_to_json(self):
        """최적화된 데이터 구조로 JSON 파일 저장"""
        try:
            filename = "kpi_inclusion_list.json"
            filepath = os.path.join(current_dir, "../../", filename)
            # 통계 정보 계산
            total_major = len(self.categories)
            total_middle = sum(len(middle_dict) for middle_dict in self.categories.values())
            total_sub = sum(
                len(sub_dict)
                for middle_dict in self.categories.values()
                for sub_dict in middle_dict.values() if isinstance(sub_dict, dict)
            )
            # Specification과 Unit 매칭 통계
            total_specs = 0
            total_units_matched = 0
            for major_dict in self.categories.values():
                for middle_dict in major_dict.values():
                    for sub_data in middle_dict.values():
                        if isinstance(sub_data, dict) and 'specifications_with_units' in sub_data:
                            specs_with_units = sub_data['specifications_with_units']
                            total_specs += len(specs_with_units)
                            total_units_matched += len([item for item in specs_with_units if item.get('unit')])
            output_data = {
                "extraction_info": {
                    "timestamp": datetime.now().isoformat(),
                    "total_major_categories": total_major,
                    "total_middle_categories": total_middle,
                    "total_sub_categories": total_sub,
                    "total_specifications": total_specs,
                    "total_units_matched": total_units_matched,
                    "unit_matching_rate": round(total_units_matched / total_specs * 100, 2) if total_specs > 0 else 0,
                    "description": "대분류>>중분류>>소분류>>Specification+Unit 매칭 데이터",
                    "optimization": "Parallel processing with unit matching"
                },
                "categories": self.categories
            }
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, ensure_ascii=False, indent=2)
            log(f"JSON 저장 완료: {filepath}")
            log(f"대분류 {total_major}, 중분류 {total_middle}, 소분류 {total_sub}")
            log(f"Specification {total_specs}개, Unit 매칭 {total_units_matched}개 ({round(total_units_matched / total_specs * 100, 1) if total_specs > 0 else 0}%)")
        except Exception as e:
            log(f"JSON 저장 오류: {str(e)}", "ERROR")
async def main():
    """메인 함수"""
    try:
        log("최적화된 병렬 크롤링 시작")
        extractor = CategoryExtractor()
        success = await extractor.run()
        if success:
            log("크롤링 완료")
            return 0
        else:
            log("크롤링 실패", "ERROR")
            return 1
    except Exception as e:
        log(f"메인 오류: {str(e)}", "ERROR")
        return 1
if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
