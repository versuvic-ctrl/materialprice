#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
최적화된 병렬 카테고리 추출 크롤러
KPI 웹사이트에서 모든 대분류, 중분류, 소분류 카테고리 정보를 병렬로 추출하여 JSON 파일로 저장
Specification과 Unit 매칭 기능 포함
"""
import os
import asyncio
import json
import sys
import traceback
import re
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


class CategoryExtractorOptimized:
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
                    headless=False,
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
                # 기존 인증 상태 로드 또는 새 컨텍스트 생성
                if os.path.exists(self.auth_file):
                    log("기존 인증 상태 로드")
                    self.context = await self.browser.new_context(
                        storage_state=self.auth_file)
                else:
                    log("새 브라우저 컨텍스트 생성")
                    self.context = await self.browser.new_context()
                self.page = await self.context.new_page()
                # 로그인
                log("로그인 시작")
                if not await self._login(self.context):
                    log("로그인 실패", "ERROR")
                    return False
                log("로그인 성공")
                # 카테고리 페이지로 이동
                log("카테고리 페이지 이동")
                if not await self._navigate_to_category():
                    log("카테고리 페이지 이동 실패", "ERROR")
                    return False
                log("카테고리 페이지 이동 성공")
                # 병렬 카테고리 크롤링
                log("병렬 크롤링 시작")
                if not await self._crawl_categories_parallel():
                    log("크롤링 실패", "ERROR")
                    return False
                log("크롤링 성공")
                # JSON 저장
                log("JSON 파일 저장")
                await self.save_to_json()
                log("JSON 파일 저장 완료")
                await self.browser.close()
                return True
        except Exception as e:
            log(f"크롤링 오류: {str(e)}", "ERROR")
            if self.browser:
                try:
                    await self.browser.close()
                except Exception:
                    pass
            return False

    async def _login(self, context):
        """로그인 (재시도 로직 포함)"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                log(f"로그인 시도 {attempt + 1}/{max_retries}")
                await self.page.goto(f"{self.base_url}/www/member/login.asp")
                await self.page.wait_for_load_state(
                    'networkidle', timeout=45000
                )
                await asyncio.sleep(2)
                # 이미 로그인되어 있는지 확인
                if "login.asp" not in self.page.url:
                    log("기존 로그인 세션 유효")
                    await context.storage_state(path=self.auth_file)
                    return True
                username = os.environ.get("KPI_USERNAME")
                password = os.environ.get("KPI_PASSWORD")
                if not username or not password:
                    raise ValueError("환경변수에 KPI_USERNAME과 KPI_PASSWORD 설정 필요")
                # 로그인 정보 입력
                await self.page.locator("#user_id").clear()
                await self.page.locator("#user_pw").clear()
                await asyncio.sleep(1)
                await self.page.locator("#user_id").fill(username)
                await asyncio.sleep(1)
                await self.page.locator("#user_pw").fill(password)
                await asyncio.sleep(1)
                await self.page.locator("#sendLogin").click()
                # 로그인 완료 대기
                await self.page.wait_for_load_state('networkidle', timeout=45000)
                await asyncio.sleep(3)
                if "login.asp" not in self.page.url:
                    log("로그인 성공")
                    await context.storage_state(path=self.auth_file)
                    return True
                else:
                    log(f"로그인 실패 (시도 {attempt + 1})")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(5)
                        if os.path.exists(self.auth_file):
                            os.remove(self.auth_file)
            except Exception as e:
                log(f"로그인 오류 (시도 {attempt + 1}): {str(e)}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(5)
        return False
    async def _navigate_to_category(self):
        """카테고리 페이지로 이동"""
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
            except Exception:
                pass
            return True
        except Exception as e:
            log(f"카테고리 페이지 이동 오류: {str(e)}", "ERROR")
            return False
    async def _close_popups(self):
        """팝업 닫기"""
        try:
            popup_selectors = [
                ".pop-btn-close",
                ".btnClosepop",
                "#popupNotice .pop-btn-close",
                ".ui-popup .pop-btn-close",
                "button[class*='close']",
                "a[class*='close']"
            ]
            for selector in popup_selectors:
                try:
                    popup_close = self.page.locator(selector)
                    if await popup_close.count() > 0:
                        for i in range(await popup_close.count()):
                            element = popup_close.nth(i)
                            if await element.is_visible():
                                await element.click(timeout=3000)
                                await self.page.wait_for_timeout(500)
                except Exception:
                    continue
            await self.page.keyboard.press('Escape')
            await self.page.wait_for_timeout(500)
        except Exception:
            pass
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
            log(f"병렬 크롤링 오류: {str(e)}", "ERROR")
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
            log(f"대분류 '{major['name']}' 처리 오류: {str(e)}", "ERROR")
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
        """병렬로 중분류 처리 (중간 저장 포함)"""
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
                # 중분류 완료 후 중간 저장
                await self._save_progress_json(f"{major_name} > {middle_name} 완료")
                log(f"    {middle_name}: 중간 저장 완료")
            finally:
                await page.close()
        except Exception as e:
            log(f"    {middle_name} 오류: {str(e)}", "ERROR")
            # 오류 발생 시에도 중간 저장 시도
            try:
                await self._save_progress_json(f"{major_name} > {middle_name} 오류 발생")
            except:
                pass
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
        except Exception:
            pass
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
                # Unit별 대표 예시 수집 및 그룹핑
                unit_groups = {}
                no_unit_specs = []
                for item in matched_data:
                    unit = item.get('unit')
                    spec = item.get('specification', '')
                    confidence = item.get('matching_confidence', 0)
                    if unit:
                        if unit not in unit_groups:
                            unit_groups[unit] = {
                                'count': 0,
                                'examples': [],
                                'high_confidence_examples': [],
                                'total_confidence': 0
                            }
                        unit_groups[unit]['count'] += 1
                        unit_groups[unit]['total_confidence'] += confidence
                        # 신뢰도가 높은 예시 우선 저장
                        if confidence > 0.7 and len(unit_groups[unit]['high_confidence_examples']) < 2:
                            unit_groups[unit]['high_confidence_examples'].append({
                                'spec': spec,
                                'confidence': confidence
                            })
                        elif len(unit_groups[unit]['examples']) < 3:
                            unit_groups[unit]['examples'].append({
                                'spec': spec,
                                'confidence': confidence
                            })
                    else:
                        # 미매칭 항목은 간단히 저장
                        short_spec = spec[:30] + '...' if len(spec) > 30 else spec
                        no_unit_specs.append(short_spec)
                # 로그 출력 구성
                log_parts = []
                # Unit별 정보 (상위 5개 Unit까지 표시)
                sorted_units = sorted(unit_groups.items(), 
                                    key=lambda x: (x[1]['count'], x[1]['total_confidence']), 
                                    reverse=True)[:5]
                for unit, info in sorted_units:
                    avg_confidence = info['total_confidence'] / info['count'] if info['count'] > 0 else 0
                    # 대표 예시 선택 (고신뢰도 우선, 없으면 일반)
                    best_examples = info['high_confidence_examples'] if info['high_confidence_examples'] else info['examples']
                    if best_examples:
                        # 첫 번째 예시는 상세히, 나머지는 요약
                        first_example = best_examples[0]['spec']
                        # Specification에서 중요 부분 추출 (규격, 크기 등)
                        important_parts = []
                        for part in first_example.split():
                            if any(char in part for char in ['×', 'x', 'X', '㎜', 'mm', 'M', 'T', 'kg', 'm']):
                                important_parts.append(part)
                                if len(important_parts) >= 2:
                                    break
                        if important_parts:
                            example_str = ' '.join(important_parts)
                        else:
                            example_str = first_example[:20] + ('...' if len(first_example) > 20 else '')
                        # 신뢰도 표시
                        confidence_indicator = "★" if avg_confidence > 0.8 else "☆" if avg_confidence > 0.6 else ""
                        if info['count'] == 1:
                            log_parts.append(f"{unit}({info['count']}개{confidence_indicator}): {example_str}")
                        else:
                            log_parts.append(f"{unit}({info['count']}개{confidence_indicator}): {example_str}...")
                    else:
                        log_parts.append(f"{unit}({info['count']}개): [예시없음]")
                # 매칭 실패한 항목이 있으면 표시
                if no_unit_specs:
                    unmatched_count = len(no_unit_specs)
                    if unmatched_count > 0:
                        # 미매칭 예시도 1개 정도 보여주기
                        example_unmatched = no_unit_specs[0] if no_unit_specs else ""
                        if unmatched_count > 1:
                            log_parts.append(f"미매칭({unmatched_count}개): {example_unmatched}...")
                        else:
                            log_parts.append(f"미매칭({unmatched_count}개): {example_unmatched}")
                # 최종 로그 출력
                if log_parts:
                    log_detail = " | ".join(log_parts)
                    log(f"      {sub_category['name']}: {spec_count}개 Spec, {unit_count}개 Unit 매칭")
                    log(f"        → [{log_detail}]")
                else:
                    log(f"      {sub_category['name']}: {spec_count}개 Spec, {unit_count}개 Unit 매칭 [매칭 실패]")
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
                            # 단위 (3번째 컬럼에서 정확한 단위만 추출)
                            unit_cell = cells.nth(2)
                            # 여러 방법으로 단위 추출 시도
                            unit_candidates = [
                                unit_cell.locator('a u'),  # <a><u>단위</u></a>
                                unit_cell.locator('u'),     # <u>단위</u>
                                unit_cell.locator('a'),     # <a>단위</a>
                                unit_cell                   # 직접 텍스트
                            ]
                            unit = ""
                            for candidate in unit_candidates:
                                try:
                                    if await candidate.count() > 0:
                                        temp_unit = await candidate.text_content()
                                        if temp_unit and temp_unit.strip():
                                            unit = temp_unit.strip()
                                            break
                                except Exception:
                                    continue
                            # 단위 정제 - 실제 단위만 추출
                            if unit:
                                # 일반적인 단위 패턴 필터링
                                common_units = ['M/T', 'kg', '㎏', 'm', 'L', 'EA', '개', 'ton', 'T', '㎥', 'm³', 'm²', '㎡', 
                                              'set', 'SET', 'Roll', 'roll', '대', '매', 'Sheet', 'sheet', 'BOX', 'box']
                                # 단위에서 숫자나 규격 정보 제거
                                clean_unit = re.sub(r'[0-9]+[.0-9]*', '', unit)  # 숫자 제거
                                clean_unit = re.sub(r'[×xX]', '', clean_unit)     # 곱셈 기호 제거
                                clean_unit = re.sub(r'[㎜mm]', '', clean_unit)     # 크기 단위 제거
                                clean_unit = re.sub(r'[()\[\]]', '', clean_unit)  # 괄호 제거
                                clean_unit = clean_unit.strip()
                                # 일반적인 단위인지 확인
                                is_valid_unit = False
                                for common_unit in common_units:
                                    if common_unit.lower() in clean_unit.lower() and len(clean_unit) <= len(common_unit) + 3:
                                        unit = common_unit
                                        is_valid_unit = True
                                        break
                                # 유효하지 않은 단위는 제거
                                if not is_valid_unit:
                                    # 단순한 단위 패턴만 허용
                                    if not re.match(r'^[a-zA-Z가-힣/㎏㎡㎥²³]+$', clean_unit) or len(clean_unit) > 10:
                                        unit = ""
                            if name and spec and unit:
                                price_info["products"].append({
                                    "name": name,
                                    "spec": spec,
                                    "unit": unit
                                })
                    except Exception:
                        continue
        except Exception:
            pass
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
        except Exception:
            pass
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
        except Exception:
            pass
        return matched_results
    def _calculate_text_similarity(self, text1, text2):
        """텍스트 유사도 계산 (개선된 버전)"""
        try:
            if not text1 or not text2:
                return 0.0
            # 소문자 변환 및 특수문자 제거
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
    async def _save_progress_json(self, progress_message=""):
        """중간 진행 상황을 JSON 파일로 저장"""
        try:
            filename = "kpi_inclusion_list_progress.json"
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
                    "progress_message": progress_message,
                    "status": "진행중",
                    "total_major_categories": total_major,
                    "total_middle_categories": total_middle,
                    "total_sub_categories": total_sub,
                    "total_specifications": total_specs,
                    "total_units_matched": total_units_matched,
                    "unit_matching_rate": round(total_units_matched / total_specs * 100, 2) if total_specs > 0 else 0,
                    "description": "대분류>>중분류>>소분류>>Specification+Unit 매칭 데이터 (진행중)",
                    "optimization": "Parallel processing with unit matching and progress saving"
                },
                "categories": self.categories
            }
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            log(f"중간 저장 오류: {str(e)}", "ERROR")

    async def save_to_json(self):
        """최종 데이터 구조로 JSON 파일 저장"""
        try:
            filename = "kpi_inclusion_list_optimized.json"
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
                    "status": "완료",
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
        extractor = CategoryExtractorOptimized()
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
