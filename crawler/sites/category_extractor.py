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
from data_processor import create_data_processor, log
from playwright.async_api import async_playwright

# 현재 디렉터리를 sys.path에 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# 환경 변수 로드
load_dotenv("../../.env.local")

log(f"DEBUG: KPI_USERNAME: {os.environ.get('KPI_USERNAME')}", "DEBUG")
log(f"DEBUG: KPI_PASSWORD: {os.environ.get('KPI_PASSWORD')}", "DEBUG")

class CategoryExtractor:
    def __init__(self):
        self.base_url = "https://www.kpi.or.kr"
        self.categories = {}
        self.auth_file = os.path.join(current_dir, "auth.json")

    async def run(self):
        """메인 실행 함수"""
        browser = None
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
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
                
                # Load existing authentication state if available
                if os.path.exists(self.auth_file):
                    log("기존 인증 상태를 로드합니다.")
                    context = await browser.new_context(storage_state=self.auth_file)
                else:
                    log("새로운 브라우저 컨텍스트를 생성합니다.")
                    context = await browser.new_context()
                
                self.page = await context.new_page()
                
                log("카테고리 추출 작업을 시작합니다.")
                
                # 로그인
                log("1단계: 로그인 시작")
                if not await self._login(context):
                    log("로그인 실패", "ERROR")
                    return False
                log("로그인 성공", "SUCCESS")
                
                # 카테고리 페이지로 이동
                log("2단계: 카테고리 페이지 이동 시작")
                if not await self._navigate_to_category():
                    log("카테고리 페이지 이동 실패", "ERROR")
                    return False
                log("카테고리 페이지 이동 성공", "SUCCESS")
                
                # 카테고리 크롤링
                log("3단계: 카테고리 크롤링 시작")
                if not await self._crawl_categories():
                    log("카테고리 크롤링 실패", "ERROR")
                    return False
                log("카테고리 크롤링 성공", "SUCCESS")
                
                # JSON 저장
                log("4단계: JSON 파일 저장")
                await self.save_to_json()
                log("JSON 파일 저장 완료", "SUCCESS")
                
                await browser.close()
                return True
                
        except Exception as e:
            log(f"크롤링 중 오류 발생: {str(e)}", "ERROR")
            log(f"상세 오류: {traceback.format_exc()}", "ERROR")
            if browser:
                try:
                    await browser.close()
                except:
                    pass
            return False

    async def _login(self, context):
        """로그인 페이지로 이동하여 로그인 수행"""
        try:
            log("로그인 페이지로 이동합니다.")
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
                log("로그인 실패: 로그인 페이지에 머물러 있습니다.", "ERROR")
                # If login fails, delete auth.json and retry (this part will be handled in a separate step if needed)
                # For now, just return False
                return False

        except Exception as e:
            log(f"로그인 중 오류 발생: {str(e)}", "ERROR")
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
                        timeout=60000,
                        wait_until="domcontentloaded"
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
                        await self.page.wait_for_timeout(2000)

                        # 소분류 크롤링 (detail.asp?CATE_CD= 링크만 사용)
                        sub_categories_data = [] # 소분류 정보를 담을 리스트 (규격, 단위 포함)
                        
                        try:
                            detail_selector = 'a[href*="detail.asp?CATE_CD="]'
                            all_links = await self.page.locator(detail_selector).all()
                            for link in all_links:
                                try:
                                    # 부모 <li> 태그의 title 속성에서 전체 이름 추출
                                    parent_li = link.locator('xpath=..')
                                    sub_name = await parent_li.get_attribute('title')
                                    sub_href = await link.get_attribute('href')
                                    if sub_href and sub_name and sub_name.strip():
                                        full_sub_url = f"{self.base_url}/www/price/{sub_href}"
                                        # 소분류 페이지에서 규격 및 단위 추출
                                        specs_and_units = await self._get_specs_and_units_for_subcategory(full_sub_url)
                                        
                                        sub_categories_data.append({
                                            'name': sub_name.strip(),
                                            'href': sub_href,
                                            'specifications': specs_and_units
                                        })
                                        log(f"    발견된 소분류: '{sub_name.strip()}' (규격 {len(specs_and_units)}개)")
                                except Exception as e:
                                    log(f"    소분류 정보 수집 중 오류: {str(e)}", "WARNING")
                                    continue
                        except Exception as e:
                            log(f"  소분류 수집 실패: {str(e)}", "ERROR")

                        # 중분류 데이터 저장
                        self.categories[major['name']][middle_name] = sub_categories_data
                        
                        log(f"  중분류 '{middle_name}': {len(sub_categories_data)}개 소분류 수집 완료")

                    except Exception as e:
                        log(f"  중분류 '{middle_name}' 처리 중 오류: {str(e)}", "ERROR")
                        self.categories[major['name']][middle_name] = []
                        continue

                log(f"대분류 '{major['name']}' 크롤링 완료")

            return True
            
        except Exception as e:
            log(f"카테고리 크롤링 중 오류 발생: {str(e)}", "ERROR")
            return False

    async def _get_specs_and_units_for_subcategory(self, sub_category_url):
        """
        소분류 페이지로 이동하여 규격(specification)과 단위(unit)를 추출합니다.
        """
        extracted_data = []
        try:
            log(f"    소분류 페이지에서 규격 및 단위 추출 시작: {sub_category_url}")
            await self.page.goto(sub_category_url)
            await self.page.wait_for_load_state('networkidle')
            await self.page.wait_for_timeout(2000)

            # "물가정보 보기" 탭으로 이동
            # '물가정보 보기' 탭 클릭 (더 안정적인 선택자 사용)
            try:
                # 여러 가능한 선택자로 시도
                tab_selectors = [
                    'a[href="#tab2"]',
                    'a[onclick*="tab2"]',
                    'a:has-text("물가정보 보기")',
                    'a:has-text("물가정보")'
                ]
                found_tab = False
                for selector in tab_selectors:
                    tab_element = self.page.locator(selector)
                    if await tab_element.count() > 0 and await tab_element.is_visible():
                        await tab_element.click()
                        found_tab = True
                        log(f"    '물가정보 보기' 탭 클릭 성공: {selector}")
                        break
                if not found_tab:
                    log("    '물가정보 보기' 탭을 찾을 수 없습니다. 기본 탭으로 진행합니다.", "WARN")
            except Exception as e:
                log(f"    '물가정보 보기' 탭 클릭 중 오류 발생: {e}", "ERROR")

            await self.page.wait_for_selector(".detl-wro.price-tb", timeout=10000) # Wait for the table to appear

            # 테이블에서 품명, 규격, 단위 추출
            table_rows = await self.page.locator(".detl-wro.price-tb tbody tr").all()

            unit_column_index = -1
            if len(table_rows) > 0:
                header_row = table_rows[0]
                header_cells = await header_row.locator("th, td").all()
                for i, cell in enumerate(header_cells):
                    cell_text = await cell.inner_text()
                    if "단위" in cell_text:
                        unit_column_index = i
                        break

            if unit_column_index == -1:
                log("    '단위' 컬럼을 찾을 수 없습니다. 기본 추출 로직을 사용합니다.", "WARN")
                # 기존 로직 유지 (td:nth-child(3) u 또는 td:nth-child(4) u)
                # 이 부분은 나중에 제거하거나, 더 나은 대체 로직으로 변경해야 합니다.
                # 현재는 임시로 기존 로직을 유지합니다.
                if len(table_rows) > 1:
                    for row in table_rows[1:]:
                        item_name_element = row.locator("td:nth-child(1) a")
                        spec_element = row.locator("td:nth-child(2)")
                        unit_element = row.locator("td:nth-child(4) u") # 이전에 수정한 부분

                        item_name = await item_name_element.inner_text() if await item_name_element.count() > 0 else ""
                        spec = await spec_element.inner_text() if await spec_element.count() > 0 else ""
                        unit = await unit_element.inner_text() if await unit_element.count() > 0 else ""

                        extracted_data.append({
                            "item_name": item_name.strip(),
                            "spec": spec.strip(),
                            "unit": unit.strip()
                        })
                    log(f"  - 소분류 '{sub_category_url}'에서 추출된 품목: {extracted_data}")
                else:
                    log(f"  - 소분류 '{sub_category_url}'에서 품목 테이블을 찾았으나 데이터 행이 없습니다.")
            else:
                log(f"    '단위' 컬럼 인덱스 발견: {unit_column_index}")
                if len(table_rows) > 1:
                    for row in table_rows[1:]:
                        item_name_element = row.locator("td:nth-child(1) a")
                        spec_element = row.locator("td:nth-child(2)")
                        # 동적으로 찾은 인덱스를 사용하여 단위 추출
                        unit_element = row.locator(f"td:nth-child({unit_column_index + 1}) u")

                        item_name = await item_name_element.inner_text() if await item_name_element.count() > 0 else ""
                        spec = await spec_element.inner_text() if await spec_element.count() > 0 else ""
                        unit = await unit_element.inner_text() if await unit_element.count() > 0 else ""

                        extracted_data.append({
                            "item_name": item_name.strip(),
                            "spec": spec.strip(),
                            "unit": unit.strip()
                        })
                    log(f"  - 소분류 '{sub_category_url}'에서 추출된 품목: {extracted_data}")
                else:
                    log(f"  - 소분류 '{sub_category_url}'에서 품목 테이블을 찾았으나 데이터 행이 없습니다.")

            units_only = [item["unit"] for item in extracted_data]
            log(f"  - 소분류 '{sub_category_url}'에서 '물가정보 보기' 탭에서 추출된 단위: {units_only}")

            # "물가추이 보기" 탭으로 이동하여 규격명 추출
            # Ensure we are on the correct tab before clicking "물가추이 보기"
            price_trend_tab_selector = 'a[href*="detail_change.asp"]';
            price_trend_tab = self.page.locator(price_trend_tab_selector);
            if await price_trend_tab.count() > 0:
                await price_trend_tab.first.click()
                log("    '물가추이 보기' 탭 클릭")
                await self.page.wait_for_load_state('networkidle')
                await self.page.wait_for_timeout(2000)

                # "selt-list" 드롭다운에서 모든 규격명 추출
                spec_options_selector = '.selt-list option'
                spec_option_elements = await self.page.locator(spec_options_selector).all()
                available_specifications = []
                for option_element in spec_option_elements:
                    spec_text = await option_element.inner_text()
                    available_specifications.append(spec_text.strip())
                # log(f"    추출된 규격명 (물가추이) 옵션: {available_specifications}")

                # extracted_data의 각 항목에 대해 규격명 매칭
                for item in extracted_data:
                    combined_name = item['item_name'] + " " + item['spec']
                    best_match_spec = ""
                    max_similarity = -1

                    # available_specifications에서 품명 부분을 제거하고 규격 부분만 추출하여 비교
                    for available_spec in available_specifications:
                        # item['spec']과 available_spec의 규격 부분만 비교
                        if item['spec'] in available_spec:
                            similarity = len(item['spec'])
                            if similarity > max_similarity:
                                max_similarity = similarity
                                best_match_spec = available_spec

                    if best_match_spec:
                        item['matched_spec'] = best_match_spec
                        # log(f"    매칭된 규격명: {combined_name} -> {best_match_spec}")
                    else:
                        item['matched_spec'] = item['spec'] # 매칭되는 규격이 없으면 원래 규격 사용
                        # log(f"    매칭 실패: {combined_name} (원래 규격 사용)")

                # 최종적으로 spec 필드를 matched_spec으로 대체하고 matched_spec 필드 삭제
                for item in extracted_data:
                    original_spec = item['spec']
                    if 'matched_spec' in item and item['matched_spec'] and item['matched_spec'] != item['spec']:
                        item['spec'] = item['matched_spec']
                        log(f"    '물가추이 보기'에서 매칭된 규격 및 단위: "
                            f"원래 규격: '{original_spec}', 매칭된 규격: '{item['spec']}', 단위: '{item['unit']}'")
                    elif 'matched_spec' in item and item['matched_spec'] == item['spec']:
                        log(f"    '물가추이 보기'에서 매칭된 규격 및 단위: "
                            f"원래 규격: '{original_spec}', 매칭된 규격: '{item['spec']}' (동일), 단위: '{item['unit']}'")
                    else:
                        log(f"    '물가추이 보기'에서 매칭 실패 (원래 규격 사용): "
                            f"규격: '{original_spec}', 단위: '{item['unit']}'")

                    if 'matched_spec' in item:
                        del item['matched_spec']

        except Exception as e:
            log(f"    _get_specs_and_units_for_subcategory 처리 중 오류 발생: {e}", "ERROR")
        return extracted_data

    async def save_to_json(self):
        """수집된 카테고리 데이터를 JSON 파일로 저장"""
        try:
            filename = "kpi_categories.json"
            
            # 통계 정보 계산
            total_major = len(self.categories)
            total_middle = sum(len(middle_dict) for middle_dict in self.categories.values())
            total_sub = sum(
                len(sub_info.get('specifications', [])) 
                for middle_dict in self.categories.values() 
                for sub_info in middle_dict.values() if isinstance(sub_info, list)
            )
            
            output_data = {
                "extraction_info": {
                    "timestamp": datetime.now().isoformat(),
                    "total_major_categories": total_major,
                    "total_middle_categories": total_middle,
                    "total_sub_categories": total_sub
                },
                "categories": self.categories
            }
            
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, ensure_ascii=False, indent=2)
            
            log(f"카테고리 데이터가 '{filename}' 파일로 저장되었습니다.")
            log(f"통계: 대분류 {total_major}개, 중분류 {total_middle}개, 소분류 {total_sub}개")
            
        except Exception as e:
            log(f"JSON 저장 중 오류 발생: {str(e)}", "ERROR")

async def main():
    """메인 함수"""
    try:
        extractor = CategoryExtractor()
        success = await extractor.run()
        if success:
            log("카테고리 추출 작업이 성공적으로 완료되었습니다.", "SUCCESS")
            return 0
        else:
            log("카테고리 추출 작업이 실패했습니다.", "ERROR")
            return 1
    except Exception as e:
        log(f"메인 함수에서 오류 발생: {str(e)}", "ERROR")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)