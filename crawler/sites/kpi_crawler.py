

# -*- coding: utf-8 -*-

import os
import asyncio
# json import removed as it is unused
import sys
import re
import psutil
from datetime import datetime
from dotenv import load_dotenv
from playwright.async_api import async_playwright
from upstash_redis import AsyncRedis
from jsonc_parser import parse_jsonc
from data_processor import create_data_processor, log


# 절대 import를 위한 경로 설정
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# parse_jsonc is already imported at the top; remove duplicate import
# log is already imported at the top; remove duplicate import


# --- 1. 초기 설정 및 환경변수 로드 ---
load_dotenv("../../.env.local")

# Supabase 클라이언트 초기화
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Service Role 키가 있으면 우선 사용, 없으면 anon 키 사용
from data_processor import log, create_data_processor, api_monitor as supabase, get_supabase_table


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

# --- 3. 크롤링 대상 카테고리 및 단위 설정 ---
INCLUSION_LIST_PATH = os.path.join(current_dir, "kpi_inclusion_list_compact.jsonc")
with open(INCLUSION_LIST_PATH, "r", encoding="utf-8") as f:
    jsonc_content = f.read()
INCLUSION_LIST = parse_jsonc(jsonc_content)

# --- 4. Playwright 웹 크롤러 클래 ---
class KpiCrawler:
    def __init__(self, target_major: str = None, target_middle: str = None,
                 target_sub: str = None, crawl_mode: str = "all",
                 start_year: str = None, start_month: str = None, max_concurrent=3):
        """
        KPI 크롤러 초기화

        Args:
            target_major: 크롤링할 대분류명 (None이면 전체)
            target_middle: 크롤링할 중분류명 (None이면 전체)
            target_sub: 크롤링할 소분류명 (None이면 전체)
            crawl_mode: 크롤링 모드
                - "all": 전체 크롤링 (기본값)
                - "major_only": 지정된 대분류만 크롤링
                - "middle_only": 지정된 대분류의 특정 중분류만 크롤링
                - "sub_only": 지정된 대분류의 특정 중분류의 특정 소분류만 크롤링
            start_year: 시작 연도 (None이면 현재 연도)
            start_month: 시작 월 (None이면 현재 월)
            max_concurrent: 최대 동시 실행 수
        """
        self.base_url = "https://www.kpi.or.kr"
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.supabase = supabase  # 전역 supabase 객체 참조

        # 새로 추가된 속성들
        self.target_major_category = target_major
        self.target_middle_category = target_middle
        self.target_sub_category = target_sub
        self.crawl_mode = crawl_mode
        self.start_year = start_year or str(datetime.now().year)
        self.start_month = start_month or str(datetime.now().month)

        self.processor = create_data_processor('kpi')

        # 배치 처리용 변수
        self.batch_data = []
        self.batch_size = 5  # 소분류 5개마다 처리
        self.processed_count = 0

        # Redis 클라이언트 초기화 (Upstash Redis REST API만 사용)
        try:
            if 'UPSTASH_REDIS_REST_URL' in os.environ and 'UPSTASH_REDIS_REST_TOKEN' in os.environ:
                self.redis = AsyncRedis(
                    url=os.environ.get("UPSTASH_REDIS_REST_URL"),
                    token=os.environ.get("UPSTASH_REDIS_REST_TOKEN")
                )
                log("✅ Upstash Redis REST API 클라이언트 초기화 성공")
            else:
                self.redis = None
                log("⚠️ UPSTASH_REDIS_REST_URL 또는 UPSTASH_REDIS_REST_TOKEN 환경 변수가 설정되지 않았습니다. 캐시 기능이 비활성화됩니다.", "WARNING")
        except Exception as e:
            self.redis = None
            log(f"⚠️ Redis 초기화 실패: {str(e)}. 캐시 기능이 비활성화됩니다.", "WARNING")

        log(f"크롤러 초기화 - 크롤링 모드: {self.crawl_mode}")
        log(f"  타겟 대분류: {self.target_major_category}")
        log(f"  타겟 중분류: {self.target_middle_category}")
        log(f"  타겟 소분류: {self.target_sub_category}")
        log(f"  시작날짜: {self.start_year}-{self.start_month}")

    async def clear_redis_cache(self, major_name: str = None, middle_name: str = None, sub_name: str = None):
        if self.redis is None:
            log("  ⚠️ Redis가 비활성화되어 캐시 삭제를 건너뜁니다.", "WARNING")
            return
            
        try:
            if major_name and middle_name and sub_name:
                # 특정 카테고리 캐시 삭제
                cache_key = f"material_prices:{major_name}:{middle_name}:{sub_name}"
                await self.redis.delete(cache_key)
                log(f"  ✅ Redis 캐시 삭제 성공: {cache_key}")
            else:
                # 모든 material_prices 캐시 삭제
                keys = []
                async for key in self.redis.scan_iter("material_prices:*"):
                    keys.append(key)
                if keys:
                    await self.redis.delete(*keys)
                    log(f"  ✅ 모든 Redis material_prices 캐시 삭제 성공: {len(keys)}개")
                else:
                    log("  ✅ 삭제할 Redis material_prices 캐시가 없습니다.")
        except Exception as e:
            log(f"  ❌ Redis 캐시 삭제 실패: {str(e)}", "ERROR")
    async def run(self):
        """크롤링 프로세스 실행"""
        browser = None
        try:
            async with async_playwright() as p:
                # GitHub Actions 환경에서 더 안정적인 브라우저 설정
                browser = await p.chromium.launch(
                    headless=True,
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
                self.context = await browser.new_context()
                self.page = await self.context.new_page()

                await self._login()
                await self._navigate_to_category()
                await self._crawl_categories()

                # 마지막 남은 배치 데이터 처리
                await self._process_final_batch()

                await self.clear_redis_cache()  # 캐시 초기화 추가

                log(f"\n🟢 === 크롤링 완료: 총 {self.processed_count}개 소분류 처리됨 === 🟢\n")

                await browser.close()
                return self.processor
        except Exception as e:
            log(f"크롤링 중 오류 발생: {str(e)}", "ERROR")
            if browser:
                try:
                    await browser.close()
                except:
                    pass
            raise

    async def _login(self):
        """로그인 페이지로 이동하여 로그인 수행 (타임아웃 및 재시도 로직 추가)"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # 타임아웃을 60초로 늘리고, 네트워크가 안정될 때까지 대기
                await self.page.goto(
                    f"{self.base_url}/www/member/login.asp",
                    timeout=60000,
                    wait_until="networkidle"
                )
                log("로그인 페이지 이동 성공")
                break  # 성공 시 재시도 중단
            except Exception as e:
                log(f"로그인 페이지 이동 실패 (시도 {attempt + 1}/{max_retries}): {e}", "WARNING")
                if attempt < max_retries - 1:
                    await asyncio.sleep(5 * (attempt + 1))  # 5초, 10초 간격으로 대기 후 재시도
                else:
                    log("로그인 페이지 이동에 최종 실패했습니다.", "ERROR")
                    raise  # 최종 실패 시 오류 발생

        username = os.environ.get("KPI_USERNAME")
        password = os.environ.get("KPI_PASSWORD")

        if not username or not password:
            raise ValueError(".env.local 파일에 KPI_USERNAME과 "
                             "KPI_PASSWORD를 설정해야 합니다.")

        # GitHub Actions 환경에서 더 안정적인 로그인 처리
        await self.page.wait_for_load_state('networkidle', timeout=45000)
        await asyncio.sleep(2)

        await self.page.locator("#user_id").fill(username)
        await asyncio.sleep(1)
        await self.page.locator("#user_pw").fill(password)
        await asyncio.sleep(1)
        await self.page.locator("#sendLogin").click()

        # 로그인 완료 대기시간 증가
        await self.page.wait_for_load_state('networkidle', timeout=45000)
        await asyncio.sleep(3)
        log("로그인 완료", "SUCCESS")

    async def _navigate_to_category(self):
        """카테고리 페이지로 이동 및 초기 설정 (재시도 로직 포함)"""
        log("종합물가정보 카테고리 페이지로 이동합니다.")

        max_retries = 3
        retry_count = 0

        while retry_count < max_retries:
            try:
                # 타임아웃을 60초로 증가
                await self.page.goto(
                    f"{self.base_url}/www/price/category.asp",
                    timeout=60000,  # 60초
                    wait_until="domcontentloaded"  # 더 빠른 로딩 완료 조건
                )

                # 페이지 로딩 완료 대기
                await self.page.wait_for_load_state('networkidle', timeout=60000)

                # 팝업 닫기 (우선 처리)
                await self._close_popups()

                # Right Quick 메뉴 숨기기
                try:
                    close_button = self.page.locator("#right_quick .q_cl")
                    if await close_button.is_visible():
                        await close_button.click()
                        log("Right Quick 메뉴를 숨겼습니다.")
                except Exception as e:
                    log(f"Right Quick 메뉴 숨기기 실패 "
                        f"(이미 숨겨져 있을 수 있음): {e}")

                log("카테고리 페이지 이동 완료", "SUCCESS")
                return  # 성공 시 함수 종료

            except Exception as e:
                retry_count += 1
                log(f"카테고리 페이지 이동 실패 (시도 {retry_count}/{max_retries}): {e}", "WARNING")

                if retry_count < max_retries:
                    wait_time = retry_count * 5  # 5초, 10초, 15초 대기
                    log(f"{wait_time}초 후 재시도합니다...", "INFO")
                    await asyncio.sleep(wait_time)
                else:
                    log("카테고리 페이지 이동 최대 재시도 횟수 초과", "ERROR")
                    raise e

    async def _close_popups(self):
        """페이지의 모든 팝업을 닫는 메서드"""
        try:
            # 1. 일반적인 팝업 닫기 버튼들 시도
            popup_close_selectors = [
                ".pop-btn-close",  # 일반적인 팝업 닫기 버튼
                ".btnClosepop",    # 특정 팝업 닫기 버튼
                "#popupNotice .pop-btn-close",  # 공지사항 팝업 닫기
                ".ui-popup .pop-btn-close",     # UI 팝업 닫기
                "button[class*='close']",       # close가 포함된 버튼
                "a[class*='close']"             # close가 포함된 링크
            ]

            for selector in popup_close_selectors:
                try:
                    popup_close = self.page.locator(selector)
                    if await popup_close.count() > 0:
                        # 모든 매칭되는 요소에 대해 닫기 시도
                        for i in range(await popup_close.count()):
                            element = popup_close.nth(i)
                            if await element.is_visible():
                                await element.click(timeout=3000)
                                log(f"팝업 닫기 성공: {selector}")
                                await self.page.wait_for_timeout(500)  # 팝업이 닫힐 시간 대기
                except Exception:
                    continue  # 다음 셀렉터 시도

            # 2. ESC 키로 팝업 닫기 시도
            await self.page.keyboard.press('Escape')
            await self.page.wait_for_timeout(500)

            log("팝업 닫기 처리 완료")
            
        except Exception as e:
            log(f"팝업 닫기 처리 중 오류: {e}")

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
            # 크롤링 모드에 따른 대분류 필터링
            if self.target_major_category:
                # 타겟 대분류가 지정된 경우, 해당 대분류만 처리
                if major['name'] != self.target_major_category:
                    continue  # 타겟 대분류가 아니면 건너뛰기

            log(f"대분류 '{major['name']}' 크롤링 시작...")
            await self.page.goto(major['url'])

            # 페이지 로딩 대기 - 기본 대기 시간만 적용 (서버 환경 고려하여 10초)
            log("페이지 로딩을 위한 기본 대기 시간 적용 (10초)")
            await self.page.wait_for_timeout(10000)

            # 주석처리: 불필요한 선택자 시도 부분 (계속 실패하여 시간만 소모)
            # try:
            #     # 카테고리 목록 컨테이너 대기 (여러 선택자 시도)
            #     selectors_to_try = [
            #         ".part-list",  # 기존 선택자
            #         "ul li a[href*='CATE_CD=']",  # 카테고리 링크들
            #         "li a[href*='/www/price/category.asp']",  # 카테고리 페이지 링크들
            #         ".category-list",  # 가능한 카테고리 리스트 클래스
            #     ]
            #
            #     page_loaded = False
            #     for selector in selectors_to_try:
            #         try:
            #             await self.page.wait_for_selector(selector, timeout=10000)
            #             log(f"페이지 로딩 완료 - 선택자: {selector}")
            #             page_loaded = True
            #             break
            #         except Exception as e:
            #             log(f"선택자 {selector} 대기 실패: {str(e)}")
            #             continue
            #
            #     if not page_loaded:
            #         log("모든 선택자 시도 실패, 기본 대기 시간 적용")
            #         await self.page.wait_for_timeout(3000)
            #
            # except Exception as e:
            #     log(f"페이지 로딩 대기 중 오류: {str(e)}")
            #     await self.page.wait_for_timeout(3000)

            # openSub() 버튼 클릭하여 모든 중분류와 소분류를 한번에 펼치기
            open_sub_selector = 'a[href="javascript:openSub();"]'
            open_sub_button = self.page.locator(open_sub_selector)
            if await open_sub_button.count() > 0:
                log("openSub() 버튼을 클릭하여 모든 분류를 펼칩니다.")
                await open_sub_button.click()
                # 분류가 펼쳐질 시간을 기다림 (2초 -> 5초로 증가)
                await self.page.wait_for_timeout(5000) # 더 넉넉한 대기 시간
                # 또는, 특정 중분류 목록이 실제로 visible 해질 때까지 기다리기 (더 견고한 방법)
                try:
                    await self.page.wait_for_selector('.part-ttl > a', state='visible', timeout=15000)
                    log("중분류 요소들이 화면에 완전히 로드되었습니다.")
                except Exception as e:
                    log(f"중분류 요소 가시성 대기 실패: {e}", "WARNING")
                    # 실패해도 일단 진행하도록 함. 다음 로직에서 다시 요소를 찾을 것이므로.

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
                # 이 부분도 위에 openSub() 처럼 대기 시간을 늘려주는 것이 좋습니다.
                category_link = 'a[href="category.asp?CATE_CD=101"]'
                await self.page.click(category_link)
                await self.page.wait_for_timeout(3000) # 1초 -> 3초로 증가
                log("중분류 및 소분류 목록을 펼쳤습니다.")

            # 소분류 목록이 나타날 때까지 대기
            # 이 wait_for_selector는 사실상 .part-ttl 아래의 중분류를 대기하는 것이므로,
            # .part-ttl이 visible 상태가 되는 것을 기다리는 것이 더 정확할 수 있습니다.
            await self.page.wait_for_selector(".part-list", timeout=15000) # 타임아웃 증가

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
                if self.crawl_mode in ["middle_only", "sub_only"] and self.target_middle_category:
                    if middle_name != self.target_middle_category:
                        log(f"  [SKIP] 타겟 중분류가 아님: '{middle_name}' 건너뜁니다.")
                        continue
                elif self.crawl_mode == "major_only":
                    # major_only 모드에서는 모든 중분류 처리
                    pass

                # 기존 INCLUSION_LIST 로직 (하위 호환성 유지)
                inclusions_for_major = INCLUSION_LIST.get(major['name'], {})

                # 대분류에 설정이 없으면 모든 중분류 제외 (단, 새로운 모드에서는 무시)
                if not inclusions_for_major and self.crawl_mode == "all":
                    log(f"  [SKIP] 포함 목록 없음: 중분류 '{middle_name}' 건너뜁니다.")
                    continue

                # 대분류가 "__ALL__"로 설정된 경우 모든 중분류 포함
                if inclusions_for_major == "__ALL__":
                    log(f"  중분류 '{middle_name}' 포함 (대분류 전체 포함 설정)")
                else:
                    # 중분류가 포함 목록에 없으면 제외
                    if middle_name not in inclusions_for_major:
                        log(f"  [SKIP] 포함 목록에 없음: 중분류 '{middle_name}' 건너뜁니다.")
                        continue

                try:
                    # 중분류 페이지로 이동
                    middle_url = f"{self.base_url}/www/price/{middle_href}"
                    log(f"  중분류 '{middle_name}' "
                        f"페이지로 이동: {middle_url}")
                    await self.page.goto(middle_url)
                    await self.page.wait_for_load_state(
                        'networkidle')

                    # 중분류 CATE_CD 추출
                    middle_cate_cd_match = re.search(r'CATE_CD=(\d+)', middle_href)
                    middle_cate_cd = middle_cate_cd_match.group(1) if middle_cate_cd_match else None

                    if not middle_cate_cd:
                        log(f"  [SKIP] 중분류 '{middle_name}'의 CATE_CD를 찾을 수 없습니다. 건너뜁니다.")
                        continue

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
                                        sub_cate_cd_match = re.search(r'CATE_CD=(\d+)', sub_href)
                                        sub_cate_cd = sub_cate_cd_match.group(1) if sub_cate_cd_match else None

                                        # 중분류 CATE_CD와 소분류 CATE_CD가 일치하는지 확인
                                        if sub_cate_cd and sub_cate_cd.startswith(middle_cate_cd):
                                            sub_categories_info.append({
                                                'name': sub_name,
                                                'href': sub_href
                                            })
                                            log(f"    발견된 소분류: "
                                                f"'{sub_name}' (CATE_CD: {sub_cate_cd})")
                                        else:
                                            log(f"    [SKIP] 중분류 '{middle_name}'과 "
                                                f"연관 없는 소분류 '{sub_name}' (CATE_CD: {sub_cate_cd}) 건너뜜")
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
                                        sub_cate_cd_match = re.search(r'CATE_CD=(\d+)', sub_href)
                                        sub_cate_cd = sub_cate_cd_match.group(1) if sub_cate_cd_match else None

                                        # 중분류 CATE_CD와 소분류 CATE_CD가 일치하는지 확인
                                        if sub_cate_cd and sub_cate_cd.startswith(middle_cate_cd):
                                            sub_categories_info.append({
                                                'name': sub_name.strip(),
                                                'href': sub_href
                                            })
                                            log(f"    발견된 소분류: "
                                                f"'{sub_name}' (CATE_CD: {sub_cate_cd})")
                                        else:
                                            log(f"    [SKIP] 중분류 '{middle_name}'과 "
                                                f"연관 없는 소분류 '{sub_name}' (CATE_CD: {sub_cate_cd}) 건너뜜")
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
        if self.crawl_mode == "sub_only" and self.target_sub_category:
            filtered_subs = []
            log(f"    [DEBUG] 타겟 소분류: '{self.target_sub_category}' (길이: {len(self.target_sub_category)})")
            log(f"    [DEBUG] 타겟 소분류 바이트: {self.target_sub_category.encode('utf-8')}")
            
            # 유니코드 정규화 import
            import unicodedata
            normalized_target = unicodedata.normalize('NFKC', self.target_sub_category)
            log(f"    [DEBUG] 타겟 소분류 정규화: '{normalized_target}'")
            
            for sub_info in sub_categories_info:
                web_name = sub_info['name']
                normalized_web = unicodedata.normalize('NFKC', web_name)
                
                log(f"    [DEBUG] 웹사이트 소분류: '{web_name}' -> 정규화: '{normalized_web}'")
                log(f"    [DEBUG] 정규화된 문자열 비교 결과: {normalized_web == normalized_target}")
                
                if normalized_web == normalized_target:
                    log(f"    [MATCH] 소분류 매칭 성공: '{web_name}'")
                    filtered_subs.append(sub_info)
                else:
                    log(f"    [SKIP] 타겟 소분류가 아님: '{web_name}' 건너뜁니다.")
                    sub_info['skip_reason'] = "타겟 소분류가 아님"
            sub_categories_info = filtered_subs
        elif self.crawl_mode in ["major_only", "middle_only"]:
            # major_only, middle_only 모드에서는 모든 소분류 처리
            pass
        elif self.crawl_mode == "all":
            # 기존 INCLUSION_LIST 로직 (하위 호환성 유지)
            inclusions_for_major = INCLUSION_LIST.get(major_name, {})

            # 대분류가 "__ALL__"로 설정된 경우 모든 중분류와 소분류 포함
            if inclusions_for_major == "__ALL__":
                log(f"    대분류 '{major_name}' 전체 포함 설정 - 중분류 '{middle_name}' 모든 소분류 포함")
            else:
                sub_inclusion_rule = inclusions_for_major.get(middle_name, {})

                # 중분류가 "__ALL__"이 아닌 경우, 특정 소분류만 포함
                if sub_inclusion_rule != "__ALL__":
                    if isinstance(sub_inclusion_rule, dict) and sub_inclusion_rule:
                        filtered_subs = []
                        for sub_info in sub_categories_info:
                            if sub_info['name'] in sub_inclusion_rule:
                                filtered_subs.append(sub_info)
                            else:
                                log(f"    [SKIP] 포함 목록에 없음: 소분류 '{sub_info['name']}' 건너뜁니다.")
                                sub_info['skip_reason'] = "포함 목록에 없음"
                        sub_categories_info = filtered_subs  # 필터링된 목록으로 교체
                    else:
                        # 빈 딕셔너리이거나 잘못된 형식인 경우 모든 소분류 제외
                        log(f"    [SKIP] 포함할 소분류 없음: 중분류 '{middle_name}' 모든 소분류 건너뜁니다.")
                        return

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
        failed_count = 0
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                sub_name = sub_categories_info[i]['name']
                log(f"    ❌ 소분류 '{sub_name}' 처리 실패: {str(result)}", "ERROR")
                failed_count += 1
            elif result is None:
                sub_name = sub_categories_info[i]['name']
                log(f"    ⚠️ 소분류 '{sub_name}' 처리 결과 없음", "WARNING")
                failed_count += 1
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

        log(f"    중분류 '{middle_name}' 완료: {success_count}/{sub_count}개 성공, {failed_count}개 실패")
        
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
                    
                    if saved_count == 0:
                        log(f"  - {batch_item['sub']}: pandas 가공 {processed_count}개, "
                            f"supabase 저장 0개 (모두 중복 데이터)")
                    else:
                        log(f"  - {batch_item['sub']}: pandas 가공 {processed_count}개, "
                            f"supabase 저장 {saved_count}개")
                else:
                    # 처리할 데이터가 없는 이유를 명확히 구분
                    if batch_item.get('skip_reason') == 'not_found':
                        log(f"  - {batch_item['sub']}: 웹사이트에서 소분류명 미발견")
                    elif batch_item.get('skip_reason') == 'no_target':
                        log(f"  - {batch_item['sub']}: 타겟 소분류가 아님 (필터링됨)")
                    else:
                        log(f"  - {batch_item['sub']}: 처리할 데이터 없음 (원인 미상)")
                    
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

    async def _crawl_single_subcategory(self, major_name, middle_name, sub_info):
        """
        [최종 완성본] 단일 소분류 페이지에 접속하여 '물가추이 보기' 탭의 모든 specification 데이터를 수집하고 처리합니다.
        다양한 테이블 구조(지역, 상세규격, 가격명)를 자동으로 감지합니다.
        """
        async with self.semaphore:
            sub_name = sub_info['name']
            sub_href = sub_info['href']
            sub_url = f"{self.base_url}/www/price/{sub_href}"

            log(f"  - [{major_name}>{middle_name}] '{sub_name}' 수집 시작")

            new_page = None
            max_retries = 3
            
            for attempt in range(max_retries):
                try:
                    # 1. 새로운 페이지 컨텍스트 생성
                    new_page = await self.context.new_page()
                    
                    # 2. 소분류의 초기 페이지('물가정보 보기' 탭)로 이동
                    await new_page.goto(sub_url, timeout=60000)
                    await new_page.wait_for_load_state('networkidle', timeout=45000)
                    
                    # 3. '물가추이 보기' 탭으로 이동
                    trend_view_tab_selector = 'a[href*="detail_change.asp"]'
                    await new_page.wait_for_selector(trend_view_tab_selector, timeout=15000)
                    await new_page.click(trend_view_tab_selector)
                    
                    # 4. '물가추이 보기' 페이지가 완전히 로드될 때까지 대기
                    spec_dropdown_selector = 'select#ITEM_SPEC_CD'
                    await new_page.wait_for_selector(spec_dropdown_selector, timeout=30000)
                    log(f"    '{sub_name}': 물가추이 보기 탭으로 이동 완료.")

                    # 5. 모든 Specification 목록 (option 태그들) 정보 수집
                    options = await new_page.locator(f'{spec_dropdown_selector} option').all()
                    specs_to_crawl = []
                    for o in options:
                        value = await o.get_attribute('value')
                        name = (await o.inner_text()).strip()
                        if value and name:
                            specs_to_crawl.append({'name': name, 'value': value})
                    
                    if not specs_to_crawl:
                        log(f"    '{sub_name}': 수집할 Specification이 없습니다. 건너뜁니다.", "WARNING")
                        await new_page.close()
                        return None # 데이터가 없으므로 None을 반환
                        
                    log(f"    '{sub_name}': 총 {len(specs_to_crawl)}개의 Specification 발견.")

                    # 이 소분류에서 최종적으로 수집될 모든 데이터를 담을 리스트
                    all_crawled_data = []

                    # 6. 각 Specification을 순회하며 데이터 수집
                    for i, spec in enumerate(specs_to_crawl):
                        try:
                            current_spec_name = spec['name']
                            current_spec_value = spec['value']
                            log(f"      - [{i+1}/{len(specs_to_crawl)}] '{current_spec_name[:30]}...' 데이터 수집")

                            # a. 드롭다운에서 현재 규격 선택
                            await new_page.select_option(spec_dropdown_selector, value=current_spec_value)

                            # b. 첫 번째 규격 조회 시에만 기간을 최대로 설정 (효율성)
                            if i == 0:
                                start_year_selector = 'select#DATA_YEAR_F'
                                all_year_options = await new_page.locator(f'{start_year_selector} option').all()
                                if all_year_options:
                                    # option 목록 중 마지막 요소(가장 오래된 연도)를 선택
                                    oldest_year_value = await all_year_options[-1].get_attribute('value')
                                    await new_page.select_option(start_year_selector, value=oldest_year_value)
                                    await new_page.select_option('select#DATA_MONTH_F', value='01')
                                    log(f"      - 기간을 최대로 설정: {oldest_year_value}년 1월부터")
                            
                            # c. 검색 버튼 클릭 및 테이블 업데이트 대기
                            search_button_selector = 'form[name="sForm"] input[type="image"]'
                            async with new_page.expect_response(lambda r: "detail_change.asp" in r.url, timeout=30000):
                                await new_page.click(search_button_selector)
                            
                            await new_page.wait_for_selector('table#priceTrendDataArea tr:nth-child(2)', timeout=15000)

                            # d. 단위(unit) 정보 가져오기 (INCLUSION_LIST 에서만)
                            unit = self._get_unit_from_inclusion_list(major_name, middle_name, sub_name, current_spec_name)
                            if not unit:
                                log(f"      - 단위 정보를 INCLUSION_LIST에서 찾을 수 없음 (null 처리).", "DEBUG")

                            # e. 테이블 구조 감지 및 데이터 파싱
                            price_table_selector = 'table#priceTrendDataArea'
                            headers = [th.strip() for th in await new_page.locator(f'{price_table_selector} th').all_inner_texts()]
                            
                            table_type = "region" # 기본값
                            if len(headers) > 1:
                                header_sample = headers[1]
                                if '가격' in header_sample or re.match(r'가[①-⑩]', header_sample):
                                    table_type = "price_name"
                                elif not self._is_region_header(header_sample):
                                    table_type = "detail_spec"
                            
                            log(f"      - 테이블 타입 감지: {table_type}")

                            rows = await new_page.locator(f'{price_table_selector} tr').all()
                            for row in rows[1:]:
                                cols_text = await row.locator('td').all_inner_texts()
                                if not cols_text: continue

                                date = cols_text[0].strip()
                                prices_text = [p.strip().replace(',', '') for p in cols_text[1:]]

                                data_headers = headers[1:] # '구분' 제외
                                for idx, header in enumerate(data_headers):
                                    if idx < len(prices_text) and prices_text[idx].isdigit():
                                        region = "전국" if table_type != "region" else header
                                        detail_spec = header if table_type != "region" else None
                                        
                                        all_crawled_data.append(self._create_data_entry(
                                            major_name, middle_name, sub_name, current_spec_name, 
                                            region, detail_spec, date, prices_text[idx], unit
                                        ))

                        except Exception as spec_e:
                            log(f"      - Specification '{spec.get('name', 'N/A')[:30]}...' 처리 중 오류: {spec_e}", "WARNING")
                            continue

                    # 7. 수집된 데이터 후처리 및 저장
                    if all_crawled_data:
                        # processed_data는 바로 all_crawled_data가 됩니다.
                        saved_count = await self.processor.save_to_supabase(all_crawled_data, 'kpi_price_data', check_duplicates=True)
                        log(f"  ✅ '{sub_name}' 완료: {len(all_crawled_data)}개 데이터 수집 → Supabase 저장 {saved_count}개 성공")
                        await self.clear_redis_cache(major_name, middle_name, sub_name)
                    else:
                        log(f"  ⚠️ '{sub_name}' 완료: 최종 저장할 데이터가 없습니다.")
                    
                    await new_page.close()
                    # 성공했으므로 재시도 루프 탈출
                    return all_crawled_data # result 대신 실제 데이터 리스트를 반환

                except Exception as e:
                    if new_page: await new_page.close()
                    
                    if attempt == max_retries - 1:
                        log(f"  ❌ 소분류 '{sub_name}' 처리 최종 실패: {str(e)}", "ERROR")
                        return None # 실패 리턴
                    else:
                        log(f"  ⚠️ 소분류 '{sub_name}' 처리 재시도 {attempt + 1}/{max_retries}: {str(e)}", "WARNING")
                        await asyncio.sleep(5)

    def _is_region_header(self, header_text):
        """헤더가 일반적인 지역명인지 판별하는 간단한 함수"""
        known_regions = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주", "수원"]
        for region in known_regions:
            if region in header_text:
                return True
        return False

    def _create_data_entry(self, major, middle, sub, spec, region, detail_spec, date, price, unit):
        """데이터베이스에 저장할 딕셔너리 객체를 생성합니다."""
        # '상세규격'이나 '가격명'이 있는 경우, 기존 규격명에 덧붙여 최종 규격명을 만듭니다.
        final_spec = f"{spec} - {detail_spec}" if detail_spec else spec
        
        return {
            'major_category': major,
            'middle_category': middle,
            'sub_category': sub,
            'specification': final_spec,
            'region': region,
            'date': f"{date.replace('.', '-')}-01", # 날짜 형식을 'YYYY-MM-DD'로 표준화
            'price': int(price),
            'unit': unit
        }

    def _get_unit_from_inclusion_list(self, major_name, middle_name, sub_name, spec_name=None):
        """INCLUSION_LIST에서 단위 정보를 가져옵니다."""
        try:
            if major_name in INCLUSION_LIST:
                major_data = INCLUSION_LIST[major_name]
                if middle_name in major_data:
                    middle_data = major_data[middle_name]
                    if isinstance(middle_data, dict) and sub_name in middle_data:
                        unit_data = middle_data[sub_name]
                        if isinstance(unit_data, str): return unit_data
                        elif isinstance(unit_data, dict):
                            if spec_name and 'specifications' in unit_data:
                                specifications = unit_data['specifications']
                                if spec_name in specifications: return specifications[spec_name]
                                for spec_key, spec_unit in specifications.items():
                                    if spec_name in spec_key or spec_key in spec_name: return spec_unit
                            if 'default' in unit_data: return unit_data['default']
            return None
        except Exception as e:
            log(f"하드코딩된 단위 정보 조회 오류: {str(e)}", "ERROR")
            return None

    def _load_unit_from_file_cache(self, cate_cd, item_cd):
        """파일 캐시에서 단위 정보를 로드합니다."""
        try:
            import json
            import os
            
            cache_file = os.path.join(os.path.dirname(__file__), 'cache', 'unit_cache.json')
            
            if not os.path.exists(cache_file):
                return None
                
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            cache_key = f"{cate_cd}_{item_cd}"
            unit = cache_data.get(cache_key)
            
            if unit:
                log(f"파일 캐시에서 단위 정보 로드: {cache_key} -> {unit}")
                return unit
                
        except Exception as e:
            log(f"파일 캐시 로드 오류: {str(e)}", "ERROR")
            
        return None

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
                            # 탭이 존재하는지 먼저 확인
                            await new_page.wait_for_selector('a:has-text("물가추이 보기")', timeout=15000)
                            
                            link_name = '물가추이 보기'
                            link_locator = new_page.get_by_role(
                                'link', name=link_name)
                            await link_locator.click(timeout=30000)
                            await new_page.wait_for_selector(
                                selector="#ITEM_SPEC_CD",
                                timeout=30000
                            )
                            break
                        except Exception as e:
                            if retry == 2:
                                raise e
                            log(f"물가추이 보기 탭 클릭 재시도 "
                                f"{retry + 1}/3: {e}", "WARNING")
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
                    'networkidle', timeout=10000)

                # 기간 선택
                year_locator = page.locator('#DATA_YEAR_F')
                await year_locator.select_option(value=self.start_year)
                month_locator = page.locator('#DATA_MONTH_F')
                await month_locator.select_option(
                    value=self.start_month)
                await page.wait_for_load_state(
                    'networkidle', timeout=10000)

                # 검색 버튼 클릭 (재시도 로직 추가)
                search_selector = 'form[name="sForm"] input[type="image"]'
                search_button = page.locator(search_selector)
                
                # 재시도 로직 (최대 3회 시도)
                for search_attempt in range(3):
                    try:
                        await search_button.click(timeout=15000)
                        await page.wait_for_load_state(
                            'networkidle', timeout=20000)
                        break
                    except Exception as search_e:
                        if search_attempt == 2:  # 마지막 시도
                            raise search_e
                        log(f"        - 검색 버튼 클릭 실패 (시도 {search_attempt + 1}/3), 2초 후 재시도...")
                        await asyncio.sleep(2)
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
            # 재시도 로직으로 테이블 대기 (최대 3회 시도)
            for table_attempt in range(3):
                try:
                    await page.wait_for_selector(
                        "#priceTrendDataArea tr", timeout=15000)
                    break
                except Exception as table_e:
                    if table_attempt == 2:  # 마지막 시도
                        raise table_e
                    log(f"        - 테이블 로딩 실패 (시도 {table_attempt + 1}/3), 2초 후 재시도...")
                    await asyncio.sleep(2)

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
# <<< 파일 맨 아래 부분을 이 코드로 전체 교체 (5/5) >>>

async def main():
    """메인 실행 로직: 명령행 인자 파싱 및 크롤러 실행"""
    # 명령행 인자 파싱 - 두 가지 방식 지원
    # 방식 1: --major="공통자재" --middle="비철금속" --sub="알루미늄" --mode="sub_only"
    # 방식 2: --major 공통자재 --middle 비철금속 --sub 알루미늄 --mode sub_only
    
    args = {}
    i = 1
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg.startswith('--'):
            key = arg.strip('-')
            if '=' in arg:
                # 방식 1: --key=value
                key, value = arg.split('=', 1)
                key = key.strip('-')
                value = value.strip('"\'')
                args[key] = value
            else:
                # 방식 2: --key value
                if i + 1 < len(sys.argv) and not sys.argv[i + 1].startswith('--'):
                    value = sys.argv[i + 1].strip('"\'')
                    args[key] = value
                    i += 1
                else:
                    args[key] = True
        i += 1
    
    target_major = args.get('major')
    target_middle = args.get('middle')
    target_sub = args.get('sub')
    crawl_mode = args.get('mode', 'all')
    start_year = args.get('start-year', '2020')
    start_month = args.get('start-month', '01').zfill(2)

    log(f"크롤링 설정:")
    log(f"  - 모드: {crawl_mode}")
    log(f"  - 대분류: {target_major}")
    log(f"  - 중분류: {target_middle}")
    log(f"  - 소분류: {target_sub}")
    log(f"  - 시작 시점: {start_year}-{start_month}")

    # 크롤링 모드에 따른 실행
    if crawl_mode == "all" and not target_major:
        # 전체 대분류 크롤링 (기존 방식)
        log("전체 대분류를 크롤링합니다.", "INFO")
        all_major_categories = list(INCLUSION_LIST.keys())
        log(f"크롤링할 대분류: {all_major_categories}", "INFO")
        
        for major in all_major_categories:
            log(f"=== {major} 크롤링 시작 ===", "SUMMARY")
            crawler = KpiCrawler(target_major=major, crawl_mode="all", 
                               start_year=start_year, start_month=start_month)
            await crawler.run()
            log(f"🟢 {major} 크롤링 완료", "SUCCESS")
        
        log("🟢 전체 대분류 크롤링 완료", "SUCCESS")
    else:
        # 선택적 크롤링
        log(f"=== {crawl_mode} 모드 크롤링 시작 ===", "SUMMARY")
        crawler = KpiCrawler(
            target_major=target_major,
            target_middle=target_middle,
            target_sub=target_sub,
            crawl_mode=crawl_mode,
            start_year=start_year,
            start_month=start_month
        )
        await crawler.run()
        log(f"🟢 {crawl_mode} 모드 크롤링 완료", "SUCCESS")


async def test_unit_extraction():
    """단위 추출 로직 테스트"""
    log("=== 단위 추출 로직 테스트 시작 ===", "SUMMARY")
    
    # 테스트할 비철금속 소분류 목록
    test_categories = [
        ("공통자재", "비철금속", "동제품(1)"),
        ("공통자재", "비철금속", "동제품(2)"),
        ("공통자재", "비철금속", "알루미늄제품(1)"),
        ("공통자재", "비철금속", "알루미늄제품(2)"),
        ("공통자재", "비철금속", "비철지금(非鐵地金)"),
        ("공통자재", "비철금속", "연(납)제품(鉛製品)")
    ]
    
    crawler = KpiCrawler(target_major="공통자재", crawl_mode="test")
    
    browser = None
    try:
        # 브라우저 시작 (run 메서드와 동일한 방식)
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
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
            crawler.context = await browser.new_context()
            crawler.page = await crawler.context.new_page()
            
            await crawler._login()
            
            for major, middle, sub in test_categories:
                log(f"\n--- {sub} 단위 추출 테스트 ---", "INFO")
                
                try:
                    # 소분류 정보 생성 (실제 크롤링에서 사용하는 형태와 동일)
                    sub_info = {'name': sub, 'href': f'price/price_list.asp?major={major}&middle={middle}&sub={sub}'}
                    sub_url = f"{crawler.base_url}/www/price/{sub_info['href']}"
                    
                    # 페이지로 이동
                    await crawler.page.goto(sub_url, timeout=60000)
                    await crawler.page.wait_for_load_state('networkidle', timeout=45000)
                    
                    # 물가추이 페이지에서 단위 추출 (올바른 매개변수 개수)
                    unit_from_trend = await crawler._extract_unit_from_price_trend_page(
                        crawler.page, sub
                    )
                    log(f"  물가추이 페이지 단위: {unit_from_trend}")
                    
                    # 물가정보 보기 탭 클릭 (더 안정적인 선택자 사용)
                    try:
                        # 여러 가능한 선택자로 시도
                        tab_selectors = [
                            'a[href="#tab2"]',
                            'a[onclick*="tab2"]',
                            'a:has-text("물가정보 보기")',
                            'a:has-text("물가정보")',
                            'li:nth-child(2) a',
                            '.tab-menu li:nth-child(2) a'
                        ]
                        
                        tab_clicked = False
                        for selector in tab_selectors:
                            try:
                                tab_element = await crawler.page.query_selector(selector)
                                if tab_element:
                                    await tab_element.click()
                                    await crawler.page.wait_for_timeout(2000)
                                    tab_clicked = True
                                    log(f"  탭 클릭 성공: {selector}")
                                    break
                            except Exception as tab_error:
                                log(f"  탭 선택자 {selector} 실패: {str(tab_error)}", "WARNING")
                                continue
                        
                        if not tab_clicked:
                            log("  ⚠️ 물가정보 보기 탭을 찾을 수 없음. 현재 페이지에서 단위 추출 시도", "WARNING")
                            
                    except Exception as tab_error:
                        log(f"  ⚠️ 탭 클릭 실패: {str(tab_error)}", "WARNING")
                    
                    # 물가정보 보기 페이지에서 단위 추출 (올바른 매개변수 개수)
                    unit_from_detail = await crawler._get_unit_from_detail_page(
                        crawler.page, sub
                    )
                    log(f"  물가정보 보기 페이지 단위: {unit_from_detail}")
                    
                    # 캐시에서 단위 확인 (redis_client 초기화 확인)
                    cached_unit = None
                    try:
                        if hasattr(crawler, 'redis_client') and crawler.redis_client:
                            cache_key = f"unit_{major}_{middle}_{sub}"
                            cached_unit = await crawler.redis_client.get(cache_key)
                        else:
                            log("  Redis 클라이언트가 초기화되지 않음", "WARNING")
                    except Exception as cache_error:
                        log(f"  캐시 확인 실패: {str(cache_error)}", "WARNING")
                    
                    log(f"  캐시된 단위: {cached_unit}")
                    
                    # 결과 비교
                    if unit_from_trend and unit_from_detail:
                        if unit_from_trend == unit_from_detail:
                            log(f"  ✅ 단위 일치: {unit_from_trend}")
                        else:
                            log(f"  ⚠️ 단위 불일치 - 추이: {unit_from_trend}, 상세: {unit_from_detail}")
                    else:
                        log(f"  ❌ 단위 추출 실패 - 추이: {unit_from_trend}, 상세: {unit_from_detail}")
                        
                except Exception as e:
                    import traceback
                    log(f"  ❌ 테스트 중 오류 발생: {str(e)}", "ERROR")
                    log(f"  상세 오류: {traceback.format_exc()}", "ERROR")
            
            log("\n=== 단위 추출 테스트 완료 ===", "SUMMARY")
            await browser.close()
        
    except Exception as e:
        log(f"❌ 테스트 중 오류 발생: {e}", "ERROR")
        import traceback
        log(f"상세 오류: {traceback.format_exc()}", "ERROR")
        if browser:
            try:
                await browser.close()
            except:
                pass


if __name__ == "__main__":
    # 명령행 인수 확인
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        # 단위 추출 테스트 실행
        asyncio.run(test_unit_extraction())
    else:
        # 일반 크롤링 실행
        # running_crawlers = check_running_crawler()
        running_crawlers = []
        if running_crawlers:
            log(f"이미 실행 중인 크롤러 {len(running_crawlers)}개 발견. 기존 크롤러 완료 후 재실행하세요.", "ERROR")
            sys.exit(1)

        asyncio.run(main())
