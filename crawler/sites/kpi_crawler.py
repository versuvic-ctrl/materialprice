

import logging
import os
import asyncio
import json
import sys
import re
import time
import psutil
from datetime import datetime
from dotenv import load_dotenv
import pandas as pd
from playwright.async_api import async_playwright, Page

# 절대 import를 위한 경로 설정
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

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

# JSONC 파일에서 단위 정보를 로드하는 함수
def load_unit_data_from_jsonc():
    """kpi_inclusion_list_compact.jsonc 파일에서 단위 정보를 로드합니다."""
    try:
        jsonc_file_path = os.path.join(current_dir, "kpi_inclusion_list_compact.jsonc")
        if os.path.exists(jsonc_file_path):
            with open(jsonc_file_path, 'r', encoding='utf-8') as f:
                # JSONC 주석 제거
                content = f.read()
                content = re.sub(r'//.*', '', content)
                content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
                data = json.loads(content)
                return data
        else:
            log(f"JSONC 파일을 찾을 수 없습니다: {jsonc_file_path}")
            return {}
    except Exception as e:
        log(f"JSONC 파일 로드 중 오류 발생: {e}")
        return {}

# JSONC 파일에서 단위 정보 로드
UNIT_DATA_FROM_JSONC = load_unit_data_from_jsonc()

# 기존 INCLUSION_LIST 호환성을 위해 JSONC 데이터를 변환
INCLUSION_LIST = UNIT_DATA_FROM_JSONC

# --- 4. Playwright 웹 크롤러 클래스 ---
class KpiCrawler:
    def __init__(self, target_major: str = None, target_middle: str = None,
                 target_sub: str = None, crawl_mode: str = "all",
                 start_year: str = None, start_month: str = None, max_concurrent=5,
                 force_refresh: bool = False):
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
            force_refresh: 캐시 우회 옵션 (True면 실시간 데이터 조회)
        """
        self.base_url = "https://www.kpi.or.kr"
        self.max_concurrent = 4  # 3에서 4로 증가 (서버 부하 고려하여 소폭 증가)
        self.semaphore = asyncio.Semaphore(self.max_concurrent)
        
        # 페이지 풀 관리 - category_extractor_optimized.py와 동일한 방식으로 간소화
        self.max_concurrent_pages = 4  # 동시 페이지 수를 3에서 4개로 증가
        self.page_semaphore = asyncio.Semaphore(self.max_concurrent_pages)
        # 페이지 풀 제거 - 각 작업마다 새 페이지 생성/닫기 방식 사용
        # self.page_pool = []
        # self.page_pool_semaphore = asyncio.Semaphore(1)  # 페이지 풀 접근 동기화
        
        self.supabase = supabase  # 전역 supabase 객체 참조
        
        # auth.json 파일 경로 추가
        self.auth_file = os.path.join(os.path.dirname(__file__), "auth.json")
        
        # 페이지 풀 관리 제거 - category_extractor_optimized.py 방식 사용
        # self.page_pool = []
        # self.pool_size = 3
        
        # 새로 추가된 속성들
        self.target_major_category = target_major
        self.target_middle_category = target_middle
        self.target_sub_category = target_sub
        self.crawl_mode = crawl_mode
        self.start_year = start_year or str(datetime.now().year)
        self.start_month = start_month or str(datetime.now().month)
        self.force_refresh = force_refresh  # 캐시 우회 옵션 저장
        
        self.processor = create_data_processor('kpi')
        
        # JSONC 포함 항목 캐싱
        self.included_categories_cache = self._build_included_categories_cache()
        
        # 타임아웃 감지 및 강제 재생성 설정
        self.page_timeout_threshold = 30  # 30초 이상 응답 없으면 강제 재생성
        self.page_last_activity = {}  # 페이지별 마지막 활동 시간 추적
        
        # 배치 처리용 변수
        self.batch_data = []
        self.batch_size = 6  # 소분류 5에서 6으로 증가 (소폭 증가)
        self.processed_count = 0
        
        log(f"크롤러 초기화 - 크롤링 모드: {self.crawl_mode}")
        log(f"  타겟 대분류: {self.target_major_category}")
        log(f"  타겟 중분류: {self.target_middle_category}")
        log(f"  타겟 소분류: {self.target_sub_category}")
        log(f"  시작날짜: {self.start_year}-{self.start_month}")
        log(f"  캐시 우회 모드: {self.force_refresh}")

    async def run(self):
        """크롤링 프로세스 실행"""
        browser = None
        try:
            async with async_playwright() as p:
                # GitHub Actions 환경에서 더 안정적인 브라우저 설정
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
                
                # 기존 인증 상태 로드 또는 새 컨텍스트 생성
                if os.path.exists(self.auth_file):
                    log("기존 인증 상태 로드")
                    self.context = await browser.new_context(
                        storage_state=self.auth_file)
                else:
                    log("새 브라우저 컨텍스트 생성")
                    self.context = await browser.new_context()
                    
                self.page = await self.context.new_page()

                await self._login()
                await self._navigate_to_category()
                await self._crawl_categories()
                
                # 마지막 남은 배치 데이터 처리
                await self._process_final_batch()
                
                log(f"\n🟢 === 크롤링 완료: 총 {self.processed_count}개 소분류 처리됨 === 🟢\n")

                # 페이지 풀 정리 제거 - 페이지 풀 관리 방식 변경
                
                await browser.close()
                return self.processor
        except Exception as e:
            log(f"크롤링 중 오류 발생: {str(e)}", "ERROR")
            # 페이지 풀 정리 제거 - 페이지 풀 관리 방식 변경
            if browser:
                try:
                    await browser.close()
                except:
                    pass
            raise

    # 페이지 풀 관리 함수들 제거 - category_extractor_optimized.py 방식 사용
    # async def _get_page_from_pool(self):
    #     """페이지 풀에서 페이지를 가져오거나 새로 생성 (간소화된 로그인 상태 확인)"""
    #     async with self.page_pool_semaphore:
    #         if self.page_pool:
    #             page = self.page_pool.pop()
    #             log(f"    📄 페이지 풀에서 페이지 가져옴 (남은 풀 크기: {len(self.page_pool)})")
    #             
    #             # 간소화된 페이지 상태 확인 - 페이지가 닫혔는지만 확인
    #             try:
    #                 # 페이지가 유효한지 간단히 확인
    #                 await page.evaluate('document.title')
    #                 log(f"    ✅ 페이지 풀 페이지 상태 유효")
    #                 return page
    #             except Exception as e:
    #                 log(f"    ⚠️ 페이지 풀 페이지 상태 확인 실패: {str(e)} - 새 페이지 생성")
    #                 try:
    #                     await page.close()
    #                 except:
    #                     pass
    #                 new_page = await self.context.new_page()
    #                 log(f"    ✅ 새 페이지 생성 완료")
    #                 return new_page
    #         else:
    #             log(f"    📄 페이지 풀이 비어있음 - 새 페이지 생성")
    #             new_page = await self.context.new_page()
    #             log(f"    ✅ 새 페이지 생성 완료")
    #             return new_page

    async def _return_page_to_pool(self, page):
        """페이지를 풀에 반환 - category_extractor_optimized.py와 동일한 방식"""
        async with self.page_pool_semaphore:
            if len(self.page_pool) < self.max_concurrent_pages:  # 최대 동시 페이지 수로 제한
                # 페이지 상태 초기화
                try:
                    await page.goto("about:blank")
                    self.page_pool.append(page)
                    log(f"    📄 페이지를 풀에 반환 (현재 풀 크기: {len(self.page_pool)})")
                except Exception as e:
                    # 페이지가 손상된 경우 닫기
                    log(f"    ⚠️ 페이지 상태 초기화 실패, 페이지 닫기: {str(e)}")
                    try:
                        await page.close()
                    except:
                        pass
            else:
                # 풀이 가득 찬 경우 페이지 닫기
                log(f"    📄 페이지 풀이 가득참 ({len(self.page_pool)}/{self.max_concurrent_pages}), 페이지 닫기")
                try:
                    await page.close()
                except:
                    pass

    async def _check_page_timeout(self, page, operation_name="operation"):
        """페이지 타임아웃 감지 및 강제 재생성"""
        page_id = id(page)
        current_time = time.time()
        
        # 마지막 활동 시간 확인
        if page_id in self.page_last_activity:
            last_activity = self.page_last_activity[page_id]
            time_since_last_activity = current_time - last_activity
            
            if time_since_last_activity > self.page_timeout_threshold:
                log(f"    ⚠️ 페이지 타임아웃 감지: {operation_name} - {time_since_last_activity:.1f}초 경과, 강제 재생성")
                
                # 페이지 강제 종료 및 새로 생성
                try:
                    await page.close()
                except:
                    pass
                
                # 새 페이지 생성
                new_page = await self.context.new_page()
                self.page_last_activity[id(new_page)] = current_time
                log(f"    ✅ 타임아웃 페이지 강제 재생성 완료")
                return new_page
        
        # 활동 시간 업데이트
        self.page_last_activity[page_id] = current_time
        return page

    async def _safe_page_operation(self, page, operation, *args, **kwargs):
        """안전한 페이지 작업 실행 (타임아웃 감지 포함)"""
        operation_name = operation.__name__ if hasattr(operation, '__name__') else str(operation)
        
        # 타임아웃 체크
        page = await self._check_page_timeout(page, operation_name)
        
        try:
            # 작업 실행
            result = await operation(page, *args, **kwargs)
            # 활동 시간 업데이트
            self.page_last_activity[id(page)] = time.time()
            return result
        except Exception as e:
            log(f"    ⚠️ 페이지 작업 실패: {operation_name} - {str(e)}")
            
            # 타임아웃 체크 (작업 실패 시에도)
            page = await self._check_page_timeout(page, f"failed_{operation_name}")
            raise e
    #             try:
    #                 await page.close()
    #             except:
    #                 pass

    # async def _cleanup_page_pool(self):
    #     """페이지 풀 정리"""
    #     while self.page_pool:
    #         page = self.page_pool.pop()
    #         try:
    #             await page.close()
    #         except:
    #             pass

    async def _login(self):
        """로그인 페이지로 이동하여 로그인 수행 (재시도 로직 포함)"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                log(f"로그인 시도 {attempt + 1}/{max_retries}")
                await self.page.goto(f"{self.base_url}/www/member/login.asp")
                await self.page.wait_for_load_state('networkidle', timeout=45000)
                await asyncio.sleep(2)

                # 이미 로그인되어 있는지 확인 (더 정확한 검증)
                if "login.asp" not in self.page.url:
                    # 로그인 상태를 더 정확히 확인하기 위해 로그아웃 버튼이나 사용자 정보 확인
                    try:
                        logout_button = self.page.locator("text=로그아웃")
                        if await logout_button.is_visible(timeout=5000):
                            log("기존 로그인 세션 유효 (로그아웃 버튼 확인)")
                            await self.context.storage_state(path=self.auth_file)
                            return True
                    except:
                        pass
                    
                    # 로그아웃 버튼이 없어도 URL로 판단
                    log("기존 로그인 세션 유효 (URL 기준)")
                    await self.context.storage_state(path=self.auth_file)
                    return True

                username = os.environ.get("KPI_USERNAME")
                password = os.environ.get("KPI_PASSWORD")

                if not username or not password:
                    raise ValueError(".env.local 파일에 KPI_USERNAME과 "
                                     "KPI_PASSWORD를 설정해야 합니다.")

                # GitHub Actions 환경에서 더 안정적인 로그인 처리
                await self.page.locator("#user_id").clear()
                await self.page.locator("#user_pw").clear()
                await asyncio.sleep(1)
                await self.page.locator("#user_id").fill(username)
                await asyncio.sleep(1)
                await self.page.locator("#user_pw").fill(password)
                await asyncio.sleep(1)
                await self.page.locator("#sendLogin").click()

                # 로그인 완료 대기시간 증가
                await self.page.wait_for_load_state('networkidle', timeout=45000)
                await asyncio.sleep(3)  # 로그인 후 추가 대기
                
                if "login.asp" not in self.page.url:
                    # 로그인 성공 여부를 더 정확히 확인
                    try:
                        logout_button = self.page.locator("text=로그아웃")
                        if await logout_button.is_visible(timeout=5000):
                            log("로그인 성공 (로그아웃 버튼 확인)", "SUCCESS")
                            # 세션 상태 저장
                            await self.context.storage_state(path=self.auth_file)
                            return True
                    except:
                        pass
                    
                    # 로그아웃 버튼이 없어도 URL로 판단
                    log("로그인 성공 (URL 기준)", "SUCCESS")
                    # 세션 상태 저장
                    await self.context.storage_state(path=self.auth_file)
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

        raise ValueError("로그인에 실패했습니다.")

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
                    parent_li = await middle_element.locator('..').get_attribute('title')
                    middle_name = parent_li if parent_li else await middle_element.inner_text()
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
                    else:
                        log(f"  중분류 '{middle_name}' 포함 (타겟 중분류 일치)")
                elif self.crawl_mode == "major_only":
                    # major_only 모드에서는 모든 중분류 처리
                    pass
                elif self.crawl_mode == "all":
                    # 기존 INCLUSION_LIST 로직 (하위 호환성 유지)
                    inclusions_for_major = INCLUSION_LIST.get(major['name'], {})
                    
                    # 대분류에 설정이 없으면 모든 중분류 제외
                    if not inclusions_for_major:
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
                    await self.page.wait_for_load_state('networkidle')
                    
                    # 중분류 페이지 안정화를 위한 추가 대기
                    await asyncio.sleep(4)  # 3초에서 4초로 증가
                    
                    # 페이지 로드 완료 확인
                    await self.page.wait_for_load_state('domcontentloaded')
                    await asyncio.sleep(3)  # 2초에서 3초로 증가

                    # 소분류가 숨겨져 있을 수 있으므로 직접 찾기
                    await self.page.wait_for_timeout(5000)  # 3초에서 5초로 증가하여 안정성 개선

                    # 소분류 크롤링 (detail.asp?CATE_CD= 링크만 사용)
                    sub_categories_info = []
                    
                    try:
                        detail_selector = 'a[href*="detail.asp?CATE_CD="]'
                        
                        # 소분류 링크가 로드될 때까지 재시도
                        for attempt in range(3):
                            try:
                                await self.page.wait_for_selector(detail_selector, timeout=10000)
                                break
                            except Exception as e:
                                if attempt == 2:
                                    log(f"  소분류 링크 대기 실패: {str(e)}")
                                    # 디버깅을 위한 페이지 스크린샷 캡처
                                    try:
                                        await self.page.screenshot(path=f"debug_middle_{middle_name}_attempt_{attempt}.png", full_page=True)
                                        log(f"  디버깅 스크린샷 저장: debug_middle_{middle_name}_attempt_{attempt}.png")
                                    except:
                                        pass
                                    raise e
                                log(f"  소분류 링크 대기 재시도 {attempt + 1}/3")
                                await asyncio.sleep(2)
                        
                        # 페이지 HTML을 확인하여 디버깅
                        page_html = await self.page.content()
                        log(f"  페이지 HTML 길이: {len(page_html)} characters")
                        
                        # subcate-up div 내용 확인
                        try:
                            subcate_up_div = await self.page.locator('div.subcate-up').inner_html()
                            log(f"  subcate-up div 내용 길이: {len(subcate_up_div)} characters")
                            log(f"  subcate-up div 내용: {subcate_up_div[:200]}...")
                        except Exception:
                            log("  subcate-up div를 찾을 수 없습니다")
                        
                        all_links = await self.page.locator(detail_selector).all()
                        log(f"    발견된 소분류 링크 개수: {len(all_links)}")
                        
                        for link in all_links:
                            try:
                                parent_li = link.locator('xpath=..')
                                sub_name = await parent_li.get_attribute('title')
                                sub_href = await link.get_attribute('href')
                                
                                if sub_href and sub_name and sub_name.strip():
                                    # category_extractor_optimized.py와 동일한 방식으로 코드 추출
                                    match = re.search(r'CATE_CD=([^&]+)', sub_href)
                                    if match:
                                        cate_cd = match.group(1)
                                        sub_categories_info.append({
                                            'name': sub_name.strip(),
                                            'code': cate_cd,
                                            'href': sub_href
                                        })
                                        log(f"    발견된 소분류: '{sub_name.strip()}'")
                                        log(f"    링크: {sub_href}")
                            except Exception as e:
                                log(f"    링크 처리 중 오류: {str(e)}")
                                continue
                    except Exception as e:
                        log(f"  소분류 수집 실패: {str(e)}")

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
                    # 중분류 처리 실패 시 페이지 상태 복구 시도
                    try:
                        await self.page.reload()
                        await self.page.wait_for_load_state('networkidle')
                        await asyncio.sleep(2)
                    except Exception as recovery_error:
                        log(f"  페이지 복구 실패: {str(recovery_error)}")
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
            import re
            normalized_target = unicodedata.normalize('NFKC', self.target_sub_category)
            log(f"    [DEBUG] 타겟 소분류 정규화: '{normalized_target}'")
            
            for sub_info in sub_categories_info:
                web_name = sub_info['name']
                normalized_web = unicodedata.normalize('NFKC', web_name)
                
                log(f"    [DEBUG] 웹사이트 소분류: '{web_name}' -> 정규화: '{normalized_web}'")
                log(f"    [DEBUG] 타겟 소분류 정규화 값: '{normalized_target}'")
                log(f"    [DEBUG] 웹사이트 소분류 정규화 값: '{normalized_web}'")
                log(f"    [DEBUG] 정규화된 문자열 비교 결과: {normalized_web == normalized_target}")
                
                # 소분류 이름에 괄호 안의 내용이 다른 경우를 대비하여, 괄호 안의 내용을 제외하고 비교
                # 예: '스테인리스물탱크(1)-1'과 '스테인리스물탱크(2)-1'을 구분하기 위함
                web_name_without_parentheses = re.sub(r'\([^)]*\)', '', normalized_web).strip()
                target_name_without_parentheses = re.sub(r'\([^)]*\)', '', normalized_target).strip()

                # 타겟 소분류에 괄호가 포함되어 있는지 확인
                if '(' in self.target_sub_category and ')' in self.target_sub_category:
                    # 괄호가 포함된 경우, 정확히 일치하는 경우만 허용
                    if normalized_web == normalized_target:
                        log(f"    [MATCH] 소분류 매칭 성공 (정확 일치): '{web_name}'")
                        filtered_subs.append(sub_info)
                    else:
                        log(f"    [SKIP] 타겟 소분류가 아님 (괄호 포함): '{web_name}' 건너뜁니다.")
                        sub_info['skip_reason'] = "타겟 소분류가 아님"
                else:
                    # 괄호가 없는 경우, 괄호 제외 비교도 허용
                    if (normalized_web == normalized_target or 
                        web_name_without_parentheses == target_name_without_parentheses):
                        log(f"    [MATCH] 소분류 매칭 성공 (유연 일치): '{web_name}'")
                        filtered_subs.append(sub_info)
                    else:
                        log(f"    [SKIP] 타겟 소분류가 아님 (유연 일치): '{web_name}' 건너뜁니다.")
                        sub_info['skip_reason'] = "타겟 소분류가 아님"
            sub_categories_info = filtered_subs
        elif self.crawl_mode in ["major_only", "middle_only"]:
            # major_only, middle_only 모드에서는 모든 소분류 처리
            pass
        elif self.crawl_mode == "all":
            # 캐싱된 JSONC 데이터를 사용하여 주석 처리되지 않은 항목만 미리 필터링
            filtered_subs = []
            
            # 캐싱된 데이터에서 해당 중분류의 포함된 소분류 목록 가져오기
            included_subs = []
            if (major_name in self.included_categories_cache and 
                middle_name in self.included_categories_cache[major_name]):
                included_subs = self.included_categories_cache[major_name][middle_name]
            
            for sub_info in sub_categories_info:
                sub_name = sub_info['name']
                
                # 캐싱된 목록에 포함되어 있는지 확인
                if sub_name in included_subs:
                    filtered_subs.append(sub_info)
                else:
                    log(f"    [SKIP] JSONC에서 주석 처리됨: 소분류 '{sub_name}' 건너뜁니다.")
                    sub_info['skip_reason'] = "JSONC에서 주석 처리됨"
            
            sub_categories_info = filtered_subs
            
            if not sub_categories_info:
                log(f"    중분류 '{middle_name}': JSONC에 포함된 소분류가 없습니다.")
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
                    saved_count = await self.processor.save_to_supabase(
                        processed_data, force_refresh=self.force_refresh
                    )
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

    async def _crawl_single_subcategory(self, major_name,
                                        middle_name, sub_info):
        """단일 소분류 크롤링 (세마포어로 동시 실행 수 제한)"""
        async with self.page_semaphore:  # 페이지 세마포어 사용
            sub_name = sub_info['name']
            sub_code = sub_info.get('code', '')
            
            # category_extractor_optimized.py와 동일한 URL 구성 방식
            sub_url = f"https://www.kpi.or.kr/www/price/detail.asp?CATE_CD={sub_code}"
            if len(sub_code) >= 4:
                item_cd = sub_code[-4:]
                sub_url += f"&ITEM_CD={item_cd}"

            log(f"  - 중분류 '{middle_name}' > "
                f"소분류 '{sub_name}' 데이터 수집 시작")

            # category_extractor_optimized.py 방식: 간단하고 확실한 페이지 관리
            new_page = await self.context.new_page()
            log(f"    새 페이지 생성: {sub_name}")
            
            try:
                # 페이지 로드 (안전한 작업으로 래핑)
                async def load_page(page):
                    await page.goto(sub_url, timeout=60000)
                    await page.wait_for_load_state('networkidle', timeout=45000)
                
                await self._safe_page_operation(new_page, load_page)
                
                # "물가추이 보기" 탭 이동 및 규격명 추출 (개선된 재시도 로직)
                for retry in range(5):
                    try:
                        # 다양한 셀렉터로 탭 찾기 시도 (사용자 제공 HTML 구조 반영)
                        selectors = [
                            'a[href*="detail_change.asp"] span:has-text("물가추이 보기")',
                            'a[href*="detail_change.asp"]',
                            'span:has-text("물가추이 보기")',
                            'a:has(span:has-text("물가추이 보기"))',
                            'a:has-text("물가추이 보기")',
                            'text=물가추이 보기',
                            'a[href*="price_trend"]',
                            'a:contains("물가추이")',
                            '.tab-menu a:has-text("물가추이")',
                            'ul.tab-list a:has-text("물가추이")'
                        ]
                        
                        clicked = False
                        for selector in selectors:
                            try:
                                async def wait_and_click(page):
                                    await page.wait_for_selector(selector, timeout=15000)
                                    await page.click(selector, timeout=45000)
                                await self._safe_page_operation(new_page, wait_and_click)
                                clicked = True
                                break
                            except:
                                continue
                        
                        if not clicked:
                            raise Exception("물가추이 보기 탭을 찾을 수 없음")
                        
                        async def wait_for_selt_list(page):
                            await page.wait_for_selector(".selt-list", timeout=15000)
                        await self._safe_page_operation(new_page, wait_for_selt_list)
                        break
                    except Exception as e:
                        if retry == 4:
                            log(f"    ❌ 물가추이 보기 탭 클릭 완전 실패: {str(e)}")
                            raise e
                        log(f"    ⚠️ 물가추이 보기 탭 클릭 재시도 {retry + 1}/5: {str(e)}")
                        await asyncio.sleep(3)
                        await new_page.reload()
                        await new_page.wait_for_load_state('networkidle', timeout=30000)
                
                # 규격명 추출 - 숨겨진 요소도 처리할 수 있도록 수정
                spec_selector = "#ITEM_SPEC_CD option:first-child"
                try:
                    # 먼저 요소가 존재하는지 확인
                    async def wait_for_spec_selector(page):
                        await page.wait_for_selector(spec_selector, timeout=5000, state='attached')
                    await self._safe_page_operation(new_page, wait_for_spec_selector)
                    # 숨겨진 요소도 텍스트를 가져올 수 있도록 수정
                    spec_name = await new_page.evaluate(f'document.querySelector("{spec_selector}").textContent')
                except Exception as e:
                    # 대안 셀렉터 시도
                    try:
                        spec_name = await new_page.locator("#ITEM_SPEC_CD option").first.inner_text()
                    except:
                        spec_name = "규격명 추출 실패"
                        log(f"    규격명 추출 실패: {str(e)}")
                
                # "물가정보 보기" 탭 이동
                async def click_price_info_tab(page):
                    await page.click("text=물가정보 보기")
                    await page.wait_for_selector("table", timeout=5000)
                await self._safe_page_operation(new_page, click_price_info_tab)
                
                # JSONC 파일에서 실제 단위 추출
                cate_cd = sub_url.split('CATE_CD=')[1].split('&')[0] if 'CATE_CD=' in sub_url else None
                item_cd = sub_url.split('ITEM_CD=')[1].split('&')[0] if 'ITEM_CD=' in sub_url else None
                
                # 하드코딩된 단위 정보 가져오기 (JSONC 파일에서만)
                unit = self._get_hardcoded_unit(major_name, middle_name, sub_name, spec_name)
                if not unit:
                    log(f"    ❌ JSONC 파일에서 단위를 찾을 수 없음: {major_name} > {middle_name} > {sub_name} > {spec_name}")
                    return None  # 단위가 없으면 해당 규격 건너뛰기
                else:
                    log(f"    ✅ JSONC 파일에서 단위 추출: {unit}")
                
                # 가격 데이터 수집
                result = await self._get_price_data_with_page(
                    new_page, major_name, middle_name, sub_name, sub_url, spec_name, unit)

                # 수집된 데이터가 있으면 즉시 처리하고 저장
                has_data = (result and hasattr(result, 'raw_data_list')
                            and result.raw_data_list)
                if has_data:
                    log(f"  - 소분류 '{sub_name}' 데이터 처리 및 저장 시작")

                    # DataFrame으로 변환
                    df = result.to_dataframe()

                    if not df.empty:
                        # DataFrame을 딕셔너리 리스트로 변환하여 저장
                        processed_data = df.to_dict(orient='records')
                        # Supabase에 저장 (중복 체크 비활성화 - 테스트용)
                        saved_count = await result.save_to_supabase(processed_data, 'kpi_price_data', check_duplicates=False)
                        log(f"  ✅ '{sub_name}' 완료: "
                            f"{len(df)}개 데이터 → Supabase 저장 {saved_count}개 성공")
                    else:
                        log(f"  ⚠️ '{sub_name}' 완료: 저장할 데이터 없음")
                else:
                    log(f"  ⚠️ '{sub_name}' 완료: 처리할 데이터 없음")

                return result

            except Exception as e:
                error_msg = (f"  ❌ 소분류 '{sub_name}' 처리 실패 "
                             f"[대분류: {major_name}, 중분류: {middle_name}]: {str(e)}")
                log(error_msg, "ERROR")
                raise e
            
            finally:
                # category_extractor_optimized.py 방식: finally 블록에서 확실한 페이지 닫기
                if new_page:
                    try:
                        await new_page.close()
                        log(f"    페이지 닫기 완료: {sub_name}")
                    except Exception as e:
                        log(f"    페이지 닫기 실패: {str(e)}")
                    new_page = None

    async def _get_price_data(self, major_name, middle_name,
                             sub_name, sub_url):
        """기존 메서드 호환성을 위한 래퍼"""
        return await self._get_price_data_with_page(
            self.page, major_name, middle_name, sub_name, sub_url)



    async def _check_existing_data(self, major_name, middle_name, 
                                  sub_name, spec_name):
        """Supabase에서 기존 데이터 확인하여 중복 체크 - 6개 필드 동일할 때 중복으로 간주 (가격 제외)"""
        try:
            response = self.supabase.table('kpi_price_data').select(
                'major_category, middle_category, sub_category, specification, region, date'
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
                # 6개 필드 동일할 때 중복으로 간주 (가격 제외 - 가격 변동 시 업데이트 허용)
                existing_data = set()
                for item in response.data:
                    existing_data.add((
                        item['major_category'], 
                        item['middle_category'], 
                        item['sub_category'], 
                        item['specification'], 
                        item['region'], 
                        item['date']
                    ))
                log(f"        - 기존 데이터 발견: {len(existing_data)}개 (6개 필드 일치 조합, 가격 변동 허용)")
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

    async def _get_price_data_with_page(
        self,
        page: Page,
        major_name: str,
        middle_name: str,
        sub_name: str,
        sub_url: str,
        specification: str,
        unit: str,
    ):
        """소분류 페이지에서 월별 가격 데이터를 추출"""
        try:
            # 페이지 상태 확인
            if page.is_closed():
                log(f"페이지가 닫혀있어 '{sub_name}' 처리를 건너뜁니다.", "ERROR")
                return None
                
            # 페이지는 이미 로드된 상태로 전달됨
            await page.wait_for_load_state('networkidle', timeout=60000)

            # '물가추이 보기' 탭으로 이동
            try:
                # GitHub Actions 환경을 위한 더 긴 대기시간
                await page.wait_for_load_state('networkidle', timeout=60000)
                await asyncio.sleep(3)  # 추가 안정화 대기
                
                # 다양한 셀렉터로 탭 찾기 시도
                selectors = [
                    'a:has-text("물가추이 보기")',
                    'a[href*="price_trend"]',
                    'a:contains("물가추이")',
                    '.tab-menu a:has-text("물가추이")',
                    'ul.tab-list a:has-text("물가추이")',
                    'a[href*="detail_change.asp"]',
                    'a:has-text("물가추이")',
                    'a:has-text("추이")',
                    'li:has-text("물가추이") a',
                    '.nav-tabs a:has-text("물가추이")',
                    'ul li a:has-text("물가추이")',
                    'a[title*="물가추이"]'
                ]
                
                # 페이지 안정화 대기 추가
                await page.wait_for_load_state('domcontentloaded', timeout=60000)
                await asyncio.sleep(3)  # 페이지 안정화 대기
                
                tab_found = False
                for selector in selectors:
                    try:
                        await page.wait_for_selector(selector, timeout=30000)
                        tab_found = True
                        break
                    except:
                        continue
                
                if not tab_found:
                    raise Exception("물가추이 보기 탭을 찾을 수 없습니다")
                
                # 재시도 로직 개선 (7회로 조정)
                for retry in range(7):
                    try:
                        # 다양한 셀렉터로 클릭 시도
                        clicked = False
                        for selector in selectors:
                            try:
                                tab_element = page.locator(selector)
                                element_count = await tab_element.count()
                                if element_count > 0:
                                    # 첫 번째 요소 선택
                                    first_element = tab_element.first
                                    await first_element.wait_for(state='visible', timeout=30000)
                                    await first_element.click(timeout=60000)
                                    clicked = True
                                    log(f"    ✅ 물가추이 보기 탭 클릭 성공 (셀렉터: {selector})")
                                    break
                            except Exception as click_error:
                                log(f"    ⚠️ 셀렉터 {selector} 클릭 실패: {str(click_error)}")
                                continue
                        
                        if not clicked:
                            raise Exception("모든 셀렉터로 탭 클릭 실패")
                        
                        # 페이지 로드 완료 대기 (더 긴 타임아웃)
                        await page.wait_for_selector("#ITEM_SPEC_CD", timeout=60000)
                        await page.wait_for_load_state('networkidle', timeout=45000)
                        await asyncio.sleep(2)  # 추가 안정화 대기
                        break
                    except Exception as e:
                        if retry == 6:
                            raise e
                        log(f"    ⚠️ 물가추이 보기 탭 클릭 재시도 {retry + 1}/7: {e}", "WARNING")
                        await asyncio.sleep(5)  # 재시도 간 대기시간
                        
                        # 페이지 상태 복구
                        try:
                            await page.reload()
                            await page.wait_for_load_state('networkidle', timeout=60000)
                            await asyncio.sleep(3)
                        except Exception as reload_error:
                            log(f"    페이지 리로드 실패: {str(reload_error)}")
                        
            except Exception as e:
                log(f"물가추이 보기 탭 클릭 완전 실패: {str(e)}", "ERROR")
                # 페이지 상태 확인 및 복구 시도
                try:
                    # 페이지 상태 검증 강화
                    current_url = page.url
                    log(f"현재 페이지 URL: {current_url}", "INFO")
                    
                    # 페이지가 올바른 상태인지 확인
                    page_title = await page.title()
                    log(f"현재 페이지 제목: {page_title}", "INFO")
                    
                    # 페이지 리로드 및 상태 복구
                    await page.reload()
                    await page.wait_for_load_state('networkidle', timeout=60000)
                    await asyncio.sleep(5)  # 더 긴 안정화 대기
                    
                    # 페이지 로드 완료 검증
                    await page.wait_for_load_state('domcontentloaded', timeout=60000)
                    
                    # 마지막 시도: 다양한 대체 셀렉터로 탭 찾기
                    alternative_selectors = [
                        'a[href*="price_trend"]',
                        'a:has-text("물가추이")',
                        'a:has-text("추이")',
                        'a[onclick*="price_trend"]',
                        'li:has-text("물가추이") a',
                        '.nav-tabs a:has-text("물가추이")',
                        'ul li a:has-text("물가추이")',
                        'a[title*="물가추이"]'
                    ]
                    
                    tab_clicked = False
                    for selector in alternative_selectors:
                        try:
                            # 요소 존재 확인
                            element_count = await page.locator(selector).count()
                            if element_count > 0:
                                log(f"대체 셀렉터 발견: {selector} (개수: {element_count})", "INFO")
                                
                                # 요소가 보이는지 확인
                                element = page.locator(selector).first
                                await element.wait_for(state='visible', timeout=15000)
                                
                                # 클릭 시도
                                await element.click(timeout=30000)
                                
                                # 클릭 후 페이지 상태 확인
                                await page.wait_for_selector("#ITEM_SPEC_CD", timeout=45000)
                                await page.wait_for_load_state('networkidle', timeout=60000)
                                
                                log(f"대체 셀렉터로 탭 클릭 성공: {selector}", "INFO")
                                tab_clicked = True
                                break
                        except Exception as selector_error:
                            log(f"대체 셀렉터 {selector} 실패: {selector_error}", "DEBUG")
                            continue
                    
                    if not tab_clicked:
                        log(f"모든 대체 방법 실패 - 소분류 건너뜀: {sub_name}", "WARNING")
                        return None
                        
                except Exception as recovery_error:
                    log(f"페이지 복구 시도 실패: {recovery_error}", "ERROR")
                    log(f"모든 대체 방법 실패 - 소분류 건너뜀: {sub_name}", "WARNING")
                    return None

            # 규격 선택 옵션들 가져오기
            spec_options = await page.locator('#ITEM_SPEC_CD option').all()
            log(f"    - 페이지에서 감지된 총 규격 옵션 수: {len(spec_options)}", "DEBUG")

            raw_item_data = {
                'major_category_name': major_name,
                'middle_category_name': middle_name,
                'sub_category_name': sub_name,
                'specification': specification,
                'unit': unit,
                'spec_data': []
            }

            # 병렬 처리를 위해 규격 데이터를 먼저 수집
            spec_list = []
            for i, option in enumerate(spec_options):
                spec_value = await option.get_attribute('value')
                spec_name = await option.inner_text()
                log(f"    - 규격 옵션 {i+1}: value='{spec_value}', name='{spec_name}'", "DEBUG")
                if spec_value and spec_name.strip():  # 빈 값 제외
                    spec_list.append({'value': spec_value, 'name': spec_name})
                    log(f"    - 유효한 규격으로 추가됨: {spec_name} (value: {spec_value})", "DEBUG")
                else:
                    log(f"    - 빈 값으로 제외됨: value='{spec_value}', name='{spec_name}'", "DEBUG")

            log(f"    - 최종 유효 규격 목록: {[spec['name'] for spec in spec_list]}", "DEBUG")
            log(f"    - 최종 유효 규격 수: {len(spec_list)}", "DEBUG")
            # 모든 규격을 최적화된 순차 처리로 진행
            log(f"    - 총 {len(spec_list)}개 유효한 규격을 "
                f"최적화된 순차 처리로 진행합니다.")
            log(f"    - 규격 목록: {[spec['name'] for spec in spec_list]}", "DEBUG")
            await self._process_specs_optimized(
                page, spec_list, raw_item_data,
                major_name, middle_name, sub_name, unit)

        except Exception as e:
            log(f"  소분류 '{sub_name}' 처리 중 오류 "
                f"[대분류: {major_name}, 중분류: {middle_name}]: {str(e)}", "ERROR")
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
            major_name, middle_name, sub_name, unit):
        """최적화된 순차 처리 - 페이지 리로드 없이 빠른 규격 변경"""
        
        # 단위 정보 사용
        raw_item_data['unit'] = unit
        log(f"      단위: {unit}")
        log(f"      _process_specs_optimized 시작 - 처리할 규격 수: {len(spec_list)}", "DEBUG")
        
        # 규격 처리 통계 초기화
        success_count = 0
        error_count = 0
        error_details = []
        
        for i, spec in enumerate(spec_list):
            try:
                spec_value = spec['value']
                spec_name = spec['name']
                log(f"      - 규격 {i + 1}/{len(spec_list)}: "
                    f"'{spec_name}' 조회 중...")
                log(f"      - 규격 상세정보: value='{spec_value}', name='{spec_name}'", "DEBUG")

                # 기존 데이터 확인
                existing_dates = await self._check_existing_data(
                    major_name, middle_name, sub_name, spec_name
                )
                log(f"      - 기존 데이터 확인 완료: {len(existing_dates) if existing_dates else 0}개 날짜", "DEBUG")

                # 규격 선택 (대기 시간 증가 및 재시도 로직 강화)
                spec_selector = '#ITEM_SPEC_CD'
                log(f"      - 규격 선택 시도: {spec_selector} -> {spec_value}", "DEBUG")
                
                # 재시도 로직 추가
                max_retries = 3
                for retry in range(max_retries):
                    try:
                        # 드롭다운이 로드될 때까지 대기
                        await page.wait_for_selector(spec_selector, timeout=5000)
                        await page.locator(spec_selector).select_option(value=spec_value)
                        
                        # 더 긴 대기 시간으로 페이지 안정화
                        await asyncio.sleep(1)  # 추가 대기
                        await page.wait_for_load_state('networkidle', timeout=8000)
                        
                        # 선택이 제대로 되었는지 확인
                        selected_value = await page.locator(spec_selector).input_value()
                        if selected_value == spec_value:
                            log(f"      - 규격 선택 성공 (시도 {retry + 1}/{max_retries})", "DEBUG")
                            break
                        else:
                            log(f"      - 규격 선택 실패: 예상값={spec_value}, 실제값={selected_value} (시도 {retry + 1}/{max_retries})", "DEBUG")
                            if retry < max_retries - 1:
                                await asyncio.sleep(2)  # 재시도 전 대기
                                continue
                            else:
                                raise Exception(f"규격 선택 실패: {spec_name}")
                    except Exception as e:
                        log(f"      - 규격 선택 오류 (시도 {retry + 1}/{max_retries}): {str(e)}", "DEBUG")
                        if retry < max_retries - 1:
                            await asyncio.sleep(2)  # 재시도 전 대기
                            continue
                        else:
                            raise e
                
                log(f"      - 규격 선택 완료 및 페이지 로딩 대기 완료", "DEBUG")

                # 기간 선택 (첫 번째 규격에서만 설정)
                if i == 0:
                    log(f"      - 첫 번째 규격이므로 기간 설정 진행", "DEBUG")
                    # 현재 날짜 가져오기
                    now = datetime.now()
                    current_year = str(now.year)
                    current_month = str(now.month).zfill(2)
                    
                    # 시작 기간: 2020년 1월
                    year_from_selector = '#DATA_YEAR_F'
                    month_from_selector = '#DATA_MONTH_F'
                    await page.locator(year_from_selector).select_option(
                        value='2020')
                    await page.locator(month_from_selector).select_option(
                        value='01')
                    
                    # 종료 기간: 다음 달
                    # 현재 달이 12월이면 다음 해 1월로 설정
                    current_month_int = int(current_month)
                    current_year_int = int(current_year)
                    if current_month_int == 12:
                        next_year = str(current_year_int + 1)
                        next_month = "01"
                    else:
                        next_year = current_year
                        next_month = str(current_month_int + 1).zfill(2)
                    
                    year_to_selector = '#DATA_YEAR_T'
                    month_to_selector = '#DATA_MONTH_T'
                    await page.locator(year_to_selector).select_option(
                        value=next_year)
                    await page.locator(month_to_selector).select_option(
                        value=next_month)
                    
                    await page.wait_for_load_state(
                        'networkidle', timeout=10000)
                    
                    # 검색 버튼 클릭 (기간 설정 후 반드시 실행) - 재시도 로직 추가
                    search_selector = 'form[name="sForm"] input[type="image"]'
                    search_button = page.locator(search_selector)
                    
                    # 재시도 로직 (최대 3회 시도)
                    for attempt in range(3):
                        try:
                            await search_button.click(timeout=10000)
                            break
                        except Exception as e:
                            if attempt == 2:  # 마지막 시도
                                raise e
                            log(f"        - 검색 버튼 클릭 실패 (시도 {attempt + 1}/3), 2초 후 재시도...")
                            await asyncio.sleep(2)
                    
                    log(f"        - 기간 설정 완료: 2020.01 ~ "
            f"{next_year}.{next_month}")
                else:
                    # 첫 번째 규격이 아닌 경우에도 검색 버튼 클릭 - 재시도 로직 추가
                    search_selector = 'form[name="sForm"] input[type="image"]'
                    search_button = page.locator(search_selector)
                    
                    # 재시도 로직 (최대 3회 시도)
                    for attempt in range(3):
                        try:
                            await search_button.click(timeout=10000)
                            break
                        except Exception as e:
                            if attempt == 2:  # 마지막 시도
                                raise e
                            log(f"        - 검색 버튼 클릭 실패 (시도 {attempt + 1}/3), 2초 후 재시도...")
                            await asyncio.sleep(2)

                # 테이블 로딩 대기 (데이터가 로드될 때까지) - 재시도 로직 추가
                table_selector = "#priceTrendDataArea tr"
                
                # 재시도 로직 (최대 3회 시도)
                for attempt in range(3):
                    try:
                        await page.wait_for_selector(table_selector, timeout=15000)
                        await page.wait_for_load_state('networkidle', timeout=10000)
                        break
                    except Exception as e:
                        if attempt == 2:  # 마지막 시도
                            raise e
                        log(f"        - 테이블 로딩 대기 실패 (시도 {attempt + 1}/3), 2초 후 재시도...")
                        await asyncio.sleep(2)

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
                    page, spec_name, raw_item_data, existing_dates, unit)
                
                # 성공적으로 처리된 규격 카운트
                success_count += 1
                log(f"      - 규격 '{spec_name}' 처리 완료 ✓", "DEBUG")

            except Exception as e:
                # 규격 처리 중 오류 - 상세 정보 수집
                error_count += 1
                error_info = {
                    'spec_name': spec['name'],
                    'spec_value': spec['value'],
                    'error_type': type(e).__name__,
                    'error_message': str(e),
                    'spec_index': i + 1
                }
                error_details.append(error_info)
                
                log(f"      - 규격 '{spec['name']}' 처리 실패 ✗ "
                    f"({error_info['error_type']}: {error_info['error_message']})", "ERROR")
                
                # 개별 규격 오류는 전체 처리를 중단하지 않고 계속 진행
                continue
        
        # 처리 완료 후 통계 출력
        total_specs = len(spec_list)
        log(f"      규격 처리 완료 - 총 {total_specs}개 중 성공: {success_count}개, "
            f"실패: {error_count}개", "INFO")
        
        if error_details:
            log(f"      실패한 규격 상세 정보:", "ERROR")
            for error in error_details:
                log(f"        - {error['spec_index']}/{total_specs}: "
                    f"'{error['spec_name']}' ({error['error_type']})", "ERROR")

    async def _extract_price_data_fast(self, page, spec_name,
                                       raw_item_data, existing_dates=None, unit_info=None):
        """빠른 가격 데이터 추출 - 누락된 데이터만 추출"""
        try:
            # 하드코딩된 단위가 있으면 우선 사용
            if unit_info:
                log(f"      - 자재: '{spec_name}' | 단위: {unit_info}")
            else:
                # 단위 정보가 없는 경우 기본값 설정
                if "나선철선" in spec_name or "철선" in spec_name:
                    unit_info = "kg"
                    log(f"      - ⚠️ 자재: '{spec_name}' | 단위 정보 없음 - 기본값 'kg' 사용")
                elif "철근" in spec_name or "봉강" in spec_name:
                    unit_info = "kg"
                    log(f"      - ⚠️ 자재: '{spec_name}' | 단위 정보 없음 - 기본값 'kg' 사용")
                elif "강판" in spec_name or "형강" in spec_name:
                    unit_info = "kg"
                    log(f"      - ⚠️ 자재: '{spec_name}' | 단위 정보 없음 - 기본값 'kg' 사용")
                else:
                    unit_info = "개"
                    log(f"      - ⚠️ 자재: '{spec_name}' | 단위 정보 없음 - 기본값 '개' 사용")
            
            # 테이블 구조 감지 및 처리
            # 1. 지역 헤더가 있는 복합 테이블 (첫 번째 이미지 형태)
            # 2. 날짜와 가격만 있는 단순 테이블 (두 번째 이미지 형태)
            
            # 테이블에서 첫 번째 행 확인
            all_table_rows = await page.locator("table").nth(1).locator("tr").all()
            if not all_table_rows:
                log(f"      - 규격 '{spec_name}': 테이블을 찾을 수 없음")
                return

            # 첫 번째 행 분석하여 테이블 타입 결정
            first_row = all_table_rows[0]
            first_row_elements = await first_row.locator("td").all()
            if not first_row_elements:
                first_row_elements = await first_row.locator("th").all()
            
            if not first_row_elements:
                log(f"      - 규격 '{spec_name}': 첫 번째 행이 비어있음")
                return

            # 첫 번째 행의 첫 번째 셀 텍스트 확인
            first_cell_text = await first_row_elements[0].inner_text()
            first_cell_clean = first_cell_text.strip()
            
            # 헤더 행에서 spec_name 기반 테이블인지 확인 (1.5㎟, 2.5㎟ 등)
            is_spec_name_table = False
            if len(first_row_elements) > 1:
                header_texts = []
                for i in range(1, min(len(first_row_elements), 4)):  # 최대 3개 헤더 확인
                    header_text = await first_row_elements[i].inner_text()
                    header_texts.append(header_text.strip())
                
                # spec_name 패턴 확인 (㎟, mm, 등의 단위가 포함된 경우)
                spec_patterns = ['㎟', 'mm', 'pair', 'core', 'sq', '×']
                for header in header_texts:
                    if any(pattern in header for pattern in spec_patterns):
                        is_spec_name_table = True
                        break
            
            # 테이블 타입 결정
            is_simple_table = (
                self._is_valid_date_value(first_cell_clean) or 
                self._is_valid_date_header(first_cell_clean)
            )
            
            if is_spec_name_table:
                # spec_name 기반 테이블 처리 (구분 + 상세규격들)
                await self._extract_spec_name_table_data(
                    all_table_rows, spec_name, raw_item_data, existing_dates, unit_info
                )
            elif is_simple_table:
                # 단순 테이블 처리 (날짜 + 가격)
                await self._extract_simple_table_data(
                    all_table_rows, spec_name, raw_item_data, existing_dates, unit_info
                )
            else:
                # 복합 테이블 처리 (지역 헤더 + 날짜별 데이터)
                await self._extract_complex_table_data(
                    all_table_rows, spec_name, raw_item_data, existing_dates, unit_info
                )

        except Exception as e:
            log(f"'{spec_name}' 오류: {str(e)}", "ERROR")

    async def _extract_simple_table_data(self, all_table_rows, spec_name, 
                                       raw_item_data, existing_dates, unit_info=None):
        """단순 테이블 데이터 추출 (날짜 + 가격 형태)"""
        try:
            extracted_count = 0
            default_region = "전국"  # 지역 정보가 없는 경우 기본값
            
            for row_idx, row in enumerate(all_table_rows):
                try:
                    # 행의 모든 셀 추출
                    cells = await row.locator("td").all()
                    if not cells:
                        cells = await row.locator("th").all()
                    
                    if len(cells) < 2:  # 최소 날짜와 가격 필요
                        continue
                    
                    # 첫 번째 셀에서 날짜 추출
                    date_str = await cells[0].inner_text()
                    date_clean = date_str.strip()
                    
                    # 날짜 유효성 검증
                    if not self._is_valid_date_value(date_clean):
                        continue
                    
                    formatted_date = self._format_date_header(date_clean)
                    if not formatted_date:
                        continue
                    
                    # 두 번째 셀에서 가격 추출
                    price_str = await cells[1].inner_text()
                    
                    if self._is_valid_price(price_str):
                        clean_price = price_str.strip().replace(',', '')
                        try:
                            price_value = float(clean_price)
                            
                            # 중복 체크 (6개 필드: major_category, middle_category, sub_category, specification, region, date - 가격 제외)
                            duplicate_key = (raw_item_data['major_category_name'], raw_item_data['middle_category_name'], 
                                           raw_item_data['sub_category_name'], spec_name, default_region, formatted_date)
                            if existing_dates and duplicate_key in existing_dates:
                                continue
                            
                            if not unit_info:
                                raise ValueError(f"단위 정보가 없습니다. spec_name: {spec_name}")
                            
                            price_data = {
                                'spec_name': spec_name,
                                'region': default_region,
                                'date': formatted_date,
                                'price': price_value,
                                'unit': unit_info
                            }
                            spec_data = raw_item_data['spec_data']
                            spec_data.append(price_data)
                            extracted_count += 1
                            
                            if extracted_count % 50 == 0:
                                log(f"진행: {extracted_count}개 추출됨")
                        except ValueError:
                            continue
                
                except Exception as e:
                    log(f"      - 행 처리 중 오류: {str(e)}")
                    continue
            
            if extracted_count > 0:
                log(f"'{spec_name}' (단순형): {extracted_count}개 완료", "SUCCESS")
                
        except Exception as e:
            log(f"단순 테이블 처리 오류: {str(e)}", "ERROR")

    async def _extract_spec_name_table_data(self, all_table_rows, spec_name, 
                                          raw_item_data, existing_dates, unit_info=None):
        """spec_name 기반 테이블 데이터 추출 (구분 + 상세규격들)"""
        try:
            extracted_count = 0
            default_region = "전국"  # spec_name 기반 테이블은 지역 구분이 없으므로 전국으로 설정
            
            # 첫 번째 행에서 헤더 정보 추출
            if not all_table_rows:
                return
                
            header_row = all_table_rows[0]
            header_cells = await header_row.locator("th").all()
            if not header_cells:
                header_cells = await header_row.locator("td").all()
            
            if len(header_cells) < 2:
                log(f"'{spec_name}' (spec_name형): 헤더가 부족함")
                return
            
            # 헤더에서 spec_name들 추출 (첫 번째는 '구분', 나머지는 상세규격들)
            spec_names = []
            for i in range(1, len(header_cells)):
                header_text = await header_cells[i].inner_text()
                spec_names.append(header_text.strip())
            
            log(f"'{spec_name}' (spec_name형): 발견된 상세규격들: {spec_names}")
            
            # 데이터 행들 처리 (첫 번째 행은 헤더이므로 제외)
            for row_idx, row in enumerate(all_table_rows[1:], 1):
                try:
                    # 행의 모든 셀 추출
                    cells = await row.locator("td").all()
                    if not cells:
                        cells = await row.locator("th").all()
                    
                    if len(cells) < 2:  # 최소 날짜와 가격 1개 필요
                        continue
                    
                    # 첫 번째 셀에서 날짜 추출
                    date_str = await cells[0].inner_text()
                    date_clean = date_str.strip()
                    
                    # 날짜 유효성 검증
                    if not self._is_valid_date_value(date_clean):
                        continue
                    
                    formatted_date = self._format_date_header(date_clean)
                    if not formatted_date:
                        continue
                    
                    # 각 상세규격별로 가격 추출
                    for spec_idx, current_spec_name in enumerate(spec_names):
                        cell_idx = spec_idx + 1  # 첫 번째 셀은 날짜이므로 +1
                        
                        if cell_idx >= len(cells):
                            continue
                        
                        price_str = await cells[cell_idx].inner_text()
                        
                        if self._is_valid_price(price_str):
                            clean_price = price_str.strip().replace(',', '')
                            try:
                                price_value = float(clean_price)
                                
                                # 중복 체크 (6개 필드: major_category, middle_category, sub_category, specification, region, date - 가격 제외)
                                duplicate_key = (raw_item_data['major_category_name'], 
                                               raw_item_data['middle_category_name'], 
                                               raw_item_data['sub_category_name'], 
                                               spec_name, default_region, formatted_date)
                                if existing_dates and duplicate_key in existing_dates:
                                    continue
                                
                                if not unit_info:
                                    raise ValueError(f"단위 정보가 없습니다. spec_name: {spec_name}")
                                
                                price_data = {
                                    'spec_name': current_spec_name,  # 상세규격명 사용
                                    'region': default_region,
                                    'date': formatted_date,
                                    'price': price_value,
                                    'unit': unit_info
                                }
                                spec_data = raw_item_data['spec_data']
                                spec_data.append(price_data)
                                extracted_count += 1
                                
                                if extracted_count % 50 == 0:
                                    log(f"진행: {extracted_count}개 추출됨")
                            except ValueError:
                                continue
                
                except Exception as e:
                    log(f"      - 행 처리 중 오류: {str(e)}")
                    continue
            
            if extracted_count > 0:
                log(f"'{spec_name}' (spec_name형): {extracted_count}개 완료", "SUCCESS")
                
        except Exception as e:
            log(f"spec_name 테이블 처리 오류: {str(e)}", "ERROR")

    async def _extract_complex_table_data(self, all_table_rows, spec_name, 
                                        raw_item_data, existing_dates, unit_info=None):
        """복합 테이블 데이터 추출 (지역 헤더 + 날짜별 데이터)"""
        try:
            # 지역 헤더 행 추출 (첫 번째 행)
            if len(all_table_rows) < 1:
                return
                
            region_header_row = all_table_rows[0]
            region_header_elements = await region_header_row.locator("td").all()
            if not region_header_elements:
                region_header_elements = await region_header_row.locator("th").all()
            
            if not region_header_elements:
                log(f"      - 규격 '{spec_name}': 지역 헤더를 찾을 수 없음")
                return

            # 지역 헤더 추출 (첫 번째 컬럼 '구분' 제외, 유효한 지역만)
            regions = []
            valid_region_indices = []
            for i in range(1, len(region_header_elements)):
                header_text = await region_header_elements[i].inner_text()
                region_name = self._clean_region_name(header_text.strip())
                if self._is_valid_region_name(region_name):
                    regions.append(region_name)
                    valid_region_indices.append(i)

            if not regions:
                return

            # 데이터 행 추출 (두 번째 행부터)
            data_rows = all_table_rows[1:] if len(all_table_rows) >= 2 else []
            if not data_rows:
                return

            extracted_count = 0
            # 각 날짜별 데이터 처리
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
                    
                    # 날짜 유효성 재검증
                    if not self._is_valid_date_header(date_clean):
                        continue

                    # 해당 행의 모든 가격 셀 추출 (첫 번째 셀 제외)
                    price_cells = await row.locator("td").all()
                    if not price_cells:
                        all_cells = await row.locator("th").all()
                        price_cells = all_cells[1:] if len(all_cells) > 1 else []

                    # 각 지역별 가격 처리
                    for region_idx, region_name in enumerate(regions):
                        cell_idx = region_idx + 1
                        if cell_idx >= len(price_cells):
                            continue
                            
                        price_cell = price_cells[cell_idx]
                        price_str = await price_cell.inner_text()
                        
                        if self._is_valid_price(price_str):
                            clean_price = price_str.strip().replace(',', '')
                            try:
                                price_value = float(clean_price)
                                
                                # 중복 체크 (7개 필드: major_category, middle_category, sub_category, specification, region, date, price)
                                duplicate_key = (raw_item_data['major_category_name'], raw_item_data['middle_category_name'], 
                                               raw_item_data['sub_category_name'], spec_name, region_name, formatted_date, str(price_value))
                                if existing_dates and duplicate_key in existing_dates:
                                    continue
                                    
                                if not unit_info:
                                    raise ValueError(f"단위 정보가 없습니다. spec_name: {spec_name}")
                                
                                price_data = {
                                    'spec_name': spec_name,
                                    'region': region_name,
                                    'date': formatted_date,
                                    'price': price_value,
                                    'unit': unit_info
                                }
                                spec_data = raw_item_data['spec_data']
                                spec_data.append(price_data)
                                extracted_count += 1
                                
                                if extracted_count % 50 == 0:
                                    log(f"진행: {extracted_count}개 추출됨")
                            except ValueError:
                                continue
                        else:
                            continue
                except Exception as e:
                    log(f"      - 행 처리 중 오류: {str(e)}")
                    continue

            if extracted_count > 0:
                log(f"'{spec_name}' (복합형): {extracted_count}개 완료", "SUCCESS")

        except Exception as e:
            log(f"복합 테이블 처리 오류: {str(e)}", "ERROR")

    def _clean_region_name(self, region_str):
        """지역명 정리 함수 - '서울1', '부산2' 형태로 정규화, '가격1', '가격2', '가①격', '가격①' 등은 '전국'으로 변환
        상세규격명(PVC, STS304, STS316, PTFE 등)이 들어온 경우도 '전국'으로 변환"""
        import re
        
        # 동그라미 숫자를 일반 숫자로 변환 (먼저 처리하여 이후 패턴 매칭에 활용)
        circle_to_num = {
            '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5',
            '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9', '⑩': '10'
        }
        
        clean_region = region_str.strip()
        for circle, num in circle_to_num.items():
            clean_region = clean_region.replace(circle, num)
        
        # 상세규격명 패턴들을 '전국'으로 변환
        spec_patterns = [
            'PVC', 'STS304', 'STS316', 'PTFE', 'Coil', 'Sheet',
            r'^\d+\.\d+mm$',  # 2.0mm, 2.5mm 등
            r'^Cover두께\s*\d+㎜$',  # Cover두께 25㎜ 등
            r'^SCS13\s+\d+K\s+(BLFF|SOFF)$',  # SCS13 10K BLFF 등
            r'^SCS13\s+\d+LB\s+HUB$',  # SCS13 150LB HUB
            r'^\([^)]+\)$',  # (단판), (보온) 등 괄호로 둘러싸인 패턴
            r'^분말식\s+PE\s+3층\s+피복강관',  # 분말식 PE 3층 피복강관 관련
            r'^폴리우레탄강관',  # 폴리우레탄강관 관련
            r'^고급형$', r'^보온$'  # 고급형, 보온
        ]
        
        # '가격1', '가격2', '가1격', '가2격' 등의 패턴은 '전국'으로 변환
        price_pattern1 = r'^가격\d*$'
        price_pattern2 = r'^가\d+격$'
        
        if re.match(price_pattern1, clean_region) or re.match(price_pattern2, clean_region):
            return "전국"
        
        # 상세규격명 패턴 체크
        for pattern in spec_patterns:
            if isinstance(pattern, str):
                if clean_region == pattern:
                    return "전국"
            else:
                if re.match(pattern, clean_region):
                    return "전국"
        
        # '서1울' → '서울1' 형태로 변환
        pattern = r'^([가-힣])(\d+)([가-힣]+)$'
        match = re.match(pattern, clean_region)
        
        if match:
            first_char, number, rest = match.groups()
            clean_region = f"{first_char}{rest}{number}"
        
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
        # 주의: '구분'은 테이블의 첫 번째 컬럼 헤더로 사용되므로 제외하지 않음
        invalid_patterns = [
            '지역', '평균', '전국', '기준', '합계', '총계', '소계',
            '단위', '원', '천원', '만원', '억원',
            '규격', '품목', '자재', '재료'
        ]
        
        # 가격 관련 패턴 체크 (동그라미 숫자 포함)
        price_patterns = [
            '가격', '가①격', '가②격', '가③격', '가④격', '가⑤격',
            '가⑥격', '가⑦격', '가⑧격', '가⑨격', '가⑩격'
        ]
        
        for pattern in invalid_patterns + price_patterns:
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
        """지역명 유효성 검증 함수 - '서울1', '부산2' 형태 허용"""
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
        # 새로운 패턴: 지역명 + 숫자 (서울1, 부산2 등)
        for region in valid_regions:
            if region in region_str:
                # 지역명이 포함되어 있고, 숫자가 뒤에 오는 패턴 허용
                pattern = f"{region}\\d*$"
                if re.search(pattern, region_str):
                    return True
                # 기존 패턴도 허용 (지역명만)
                if region_str == region:
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
            '구분', '평균', '기준', '합계', '총계', '소계',
            '단위', '원', '천원', '만원', '억원',
            '년', '월', '일', '기간',
            '-', '/', '\\', '|', '+', '='
        ]
        
        for pattern in invalid_patterns:
            if pattern in region_str:
                # 로그 최적화: 잘못된 패턴 제외 로그 생략
                return False
        
        # '가격1', '가격2' 등의 패턴은 유효한 지역명으로 간주하되, 나중에 '전국'으로 변환
        price_pattern = r'^가격\d*$'
        if re.match(price_pattern, region_str):
            return True
        
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
        """가격 데이터 유효성 검증 - 변형된 형태 포함"""
        if not price_str:
            return False
        
        price_stripped = price_str.strip()
        if (not price_stripped or 
            price_stripped == '-' or 
            price_stripped == ''):
            return False
        
        # 변형된 가격 컬럼명 처리 ('가①격', '가②격' 등)
        # 숫자와 특수문자가 포함된 가격 헤더는 제외
        if any(char in price_stripped for char in ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']):
            return False
        
        # 한글이 포함된 경우 제외 (헤더일 가능성)
        if any('\u3131' <= char <= '\u3163' or '\uac00' <= char <= '\ud7a3' for char in price_stripped):
            return False
        
        # 영문자가 포함된 경우 제외 (헤더일 가능성)
        if any(char.isalpha() for char in price_stripped):
            return False
            
        clean_price = price_stripped.replace(',', '')
        try:
            float(clean_price)
            return True
        except ValueError:
            return False

            # await page.close()
            
            # if unit:
            #     log(f"단위 정보 추출 성공: {cate_cd}-{item_cd} -> {unit}")
            #     return unit
            # else:
            #     log(f"단위 정보를 찾을 수 없음: {cate_cd}-{item_cd}")
            #     return None
                
        # except Exception as e:
        #     log(f"단위 정보 추출 중 오류 발생: {cate_cd}-{item_cd}, {str(e)}", "ERROR")
        #     if 'page' in locals():
        #         await page.close()
        #     return None

    # 더 이상 사용하지 않는 unit 추출 함수 (하드코딩된 unit 사용으로 대체)
    # def _get_unit_with_caching(self, cate_cd, item_cd):
    #     """캐싱을 사용하여 단위 정보를 가져옵니다."""
    #     # 캐시 키 생성
    #     cache_key = f"unit_{cate_cd}_{item_cd}"
    #     
    #     # 메모리 캐시에서 확인
    #     if not hasattr(self, '_unit_cache'):
    #         self._unit_cache = {}
    #     
    #     if cache_key in self._unit_cache:
    #         return self._unit_cache[cache_key]
    #     
    #     # 파일 캐시에서 확인
    #     unit = self._load_unit_from_file_cache(cate_cd, item_cd)
    #     if unit:
    #         # 메모리 캐시에도 저장
    #         self._unit_cache[cache_key] = unit
    #         return unit
    #     
    #     # 캐시에 없으면 None 반환 (비동기 함수에서 실제 추출)
    #     return None
    
    # 더 이상 사용하지 않는 unit 추출 함수 (하드코딩된 unit 사용으로 대체)
    # def _cache_unit(self, cate_cd, item_cd, unit):
    #     """단위 정보를 캐시에 저장합니다."""
    #     if not hasattr(self, '_unit_cache'):
    #         self._unit_cache = {}
    #     
    #     cache_key = f"unit_{cate_cd}_{item_cd}"
    #     self._unit_cache[cache_key] = unit
    #     log(f"단위 정보 캐시 저장: {cache_key} -> {unit}")
    #     
    #     # 파일 기반 캐시에도 저장
    #     self._save_unit_to_file_cache(cate_cd, item_cd, unit)

    # 더 이상 사용하지 않는 unit 추출 함수 (하드코딩된 unit 사용으로 대체)
    # def _save_unit_to_file_cache(self, cate_cd, item_cd, unit):
    #     """단위 정보를 파일 캐시에 저장합니다."""
    #     try:
    #         import json
    #         import os
    #         
    #         cache_dir = os.path.join(os.path.dirname(__file__), 'cache')
    #         os.makedirs(cache_dir, exist_ok=True)
    #         
    #         cache_file = os.path.join(cache_dir, 'unit_cache.json')
    #         
    #         # 기존 캐시 로드
    #         cache_data = {}
    #         if os.path.exists(cache_file):
    #             with open(cache_file, 'r', encoding='utf-8') as f:
    #                 cache_data = json.load(f)
    #         
    #         # 새 데이터 추가
    #         cache_key = f"{cate_cd}_{item_cd}"
    #         cache_data[cache_key] = unit
    #         
    #         # 파일에 저장
    #         with open(cache_file, 'w', encoding='utf-8') as f:
    #             json.dump(cache_data, f, ensure_ascii=False, indent=2)
    #             
    #         log(f"파일 캐시 저장: {cache_key} -> {unit}")
    #         
    #     except Exception as e:
    #         log(f"파일 캐시 저장 오류: {str(e)}", "ERROR")

    def _get_hardcoded_unit(self, major_name, middle_name, sub_name, spec_name=None):
        """JSONC 파일에서 단위 정보를 조회합니다 - 동적 매핑 방식"""
        try:
            print(f"[DEBUG] JSONC 파일에서 단위 조회 시작: major='{major_name}', middle='{middle_name}', sub='{sub_name}'")
            print(f"[DEBUG] UNIT_DATA_FROM_JSONC keys: {list(UNIT_DATA_FROM_JSONC.keys())}")
            
            # 1. 먼저 정확한 대분류명으로 찾기 시도
            if major_name in UNIT_DATA_FROM_JSONC:
                print(f"[DEBUG] 대분류 '{major_name}' 정확 매칭 성공")
                major_data = UNIT_DATA_FROM_JSONC[major_name]
            else:
                # 2. 정확한 매칭이 실패하면 JSONC 파일의 모든 대분류에서 중분류와 소분류를 찾아서 매핑
                print(f"[DEBUG] 대분류 '{major_name}' 정확 매칭 실패, 동적 매핑 시도")
                found_major = None
                
                for jsonc_major_name, jsonc_major_data in UNIT_DATA_FROM_JSONC.items():
                    if isinstance(jsonc_major_data, dict):
                        # 중분류에서 찾기
                        if middle_name in jsonc_major_data:
                            middle_data = jsonc_major_data[middle_name]
                            if isinstance(middle_data, dict) and sub_name in middle_data:
                                found_major = jsonc_major_name
                                log(f"[DEBUG] 동적 매핑 성공: '{major_name}' -> '{found_major}' (중분류 '{middle_name}', 소분류 '{sub_name}' 기준)")
                                break
                        
                        # 중분류 정확 매칭이 실패하면 유사 매칭 시도
                        for jsonc_middle_name, jsonc_middle_data in jsonc_major_data.items():
                            if isinstance(jsonc_middle_data, dict):
                                # 중분류 유사 매칭
                                middle_without_hanja = re.sub(r'\([^)]*\)', '', middle_name).strip()
                                jsonc_middle_without_hanja = re.sub(r'\([^)]*\)', '', jsonc_middle_name).strip()
                                
                                if (middle_without_hanja == jsonc_middle_without_hanja or 
                                    middle_name == jsonc_middle_name):
                                    # 소분류에서 찾기
                                    if sub_name in jsonc_middle_data:
                                        found_major = jsonc_major_name
                                        middle_name = jsonc_middle_name  # 매핑된 중분류명으로 업데이트
                                        log(f"[DEBUG] 동적 매핑 성공 (중분류 유사매칭): '{major_name}' -> '{found_major}', 중분류 '{middle_name}' -> '{jsonc_middle_name}'")
                                        break
                                    
                                    # 소분류 유사 매칭 시도
                                    for jsonc_sub_name in jsonc_middle_data.keys():
                                        sub_without_hanja = re.sub(r'\([^)]*\)', '', sub_name).strip()
                                        jsonc_sub_without_hanja = re.sub(r'\([^)]*\)', '', jsonc_sub_name).strip()
                                        
                                        if (sub_without_hanja == jsonc_sub_without_hanja or 
                                            sub_name == jsonc_sub_name):
                                            found_major = jsonc_major_name
                                            middle_name = jsonc_middle_name  # 매핑된 중분류명으로 업데이트
                                            sub_name = jsonc_sub_name  # 매핑된 소분류명으로 업데이트
                                            log(f"[DEBUG] 동적 매핑 성공 (소분류 유사매칭): '{major_name}' -> '{found_major}', 중분류 -> '{jsonc_middle_name}', 소분류 -> '{jsonc_sub_name}'")
                                            break
                            
                            if found_major:
                                break
                    
                    if found_major:
                        break
                
                if found_major:
                    major_data = UNIT_DATA_FROM_JSONC[found_major]
                    major_name = found_major  # 매핑된 대분류명으로 업데이트
                else:
                    log(f"[DEBUG] 동적 매핑 실패: 대분류 '{major_name}'에 해당하는 중분류 '{middle_name}', 소분류 '{sub_name}'를 찾을 수 없음")
                    return None
            
            # UNIT_DATA_FROM_JSONC에서 해당 경로의 단위 정보 찾기
            if major_name in UNIT_DATA_FROM_JSONC:
                log(f"[DEBUG] 대분류 '{major_name}' 발견")
                major_data = UNIT_DATA_FROM_JSONC[major_name]
                
                if middle_name in major_data:
                    log(f"[DEBUG] 중분류 '{middle_name}' 발견")
                    middle_data = major_data[middle_name]
                    
                    log(f"[DEBUG] 중분류 데이터 키들: {list(middle_data.keys())}")
                    
                    # 정확한 매칭 시도
                    if isinstance(middle_data, dict) and sub_name in middle_data:
                        log(f"[DEBUG] 소분류 '{sub_name}' 정확 매칭 성공")
                        unit_data = middle_data[sub_name]
                        
                        # 단순 문자열인 경우 (기존 방식)
                        if isinstance(unit_data, str):
                                log(f"JSONC 단위 정보 발견: {major_name} > {middle_name} > {sub_name} = {unit_data}")
                                return unit_data
                        
                        # 객체인 경우 (새로운 JSONC 구조)
                        elif isinstance(unit_data, dict):
                            # unit 키가 있는 경우 직접 반환
                            if 'unit' in unit_data:
                                unit = unit_data['unit']
                                log(f"JSONC 단위 정보 발견: {major_name} > {middle_name} > {sub_name} = {unit}")
                                return unit
                            
                            # 규격명이 제공된 경우 specifications에서 찾기
                            if spec_name and 'specifications' in unit_data:
                                specifications = unit_data['specifications']
                                
                                # 정확한 규격명 매칭
                                if spec_name in specifications:
                                    unit = specifications[spec_name]
                                    log(f"JSONC 규격별 단위 정보 발견: {major_name} > {middle_name} > {sub_name} > {spec_name} = {unit}")
                                    return unit
                                
                                # 부분 매칭 시도
                                for spec_key, spec_unit in specifications.items():
                                    if spec_name in spec_key or spec_key in spec_name:
                                        log(f"JSONC 규격별 단위 정보 부분 매칭: {major_name} > {middle_name} > {sub_name} > {spec_name} ≈ {spec_key} = {spec_unit}")
                                        return spec_unit
                            
                            # 기본 단위 반환
                            if 'default' in unit_data:
                                default_unit = unit_data['default']
                                log(f"JSONC 기본 단위 정보 사용: {major_name} > {middle_name} > {sub_name} = {default_unit}")
                                return default_unit
                    else:
                        # 정확한 매칭 실패 시 유사 매칭 시도
                        log(f"[DEBUG] 정확한 매칭 실패, 유사 매칭 시도")
                        for key in middle_data.keys():
                            # 한자 부분을 제거하고 비교
                            key_without_hanja = re.sub(r'\([^)]*\)', '', key).strip()
                            sub_without_hanja = re.sub(r'\([^)]*\)', '', sub_name).strip()
                            
                            log(f"[DEBUG] 키 비교: '{key}' vs '{sub_name}'")
                            log(f"[DEBUG] 한자 제거 후: '{key_without_hanja}' vs '{sub_without_hanja}'")
                            
                            # 정규화된 문자열로 비교
                            if key_without_hanja == sub_without_hanja or key == sub_name:
                                log(f"[DEBUG] 유사 매칭 성공: '{key}' ≈ '{sub_name}'")
                                unit_data = middle_data[key]
                                
                                if isinstance(unit_data, str):
                                    log(f"JSONC 단위 정보 발견 (유사매칭): {major_name} > {middle_name} > {key} = {unit_data}")
                                    return unit_data
                                elif isinstance(unit_data, dict) and 'default' in unit_data:
                                    default_unit = unit_data['default']
                                    log(f"JSONC 기본 단위 정보 사용 (유사매칭): {major_name} > {middle_name} > {key} = {default_unit}")
                                    return default_unit
                        
                        log(f"[DEBUG] 소분류 '{sub_name}' 매칭 실패. 사용 가능한 소분류: {list(middle_data.keys()) if isinstance(middle_data, dict) else 'dict가 아님'}")
                else:
                    log(f"[DEBUG] 중분류 '{middle_name}' 없음. 사용 가능한 중분류: {list(major_data.keys())}")
            else:
                log(f"[DEBUG] 대분류 '{major_name}' 없음. 사용 가능한 대분류: {list(UNIT_DATA_FROM_JSONC.keys())}")
            
            log(f"JSONC 단위 정보 없음: {major_name} > {middle_name} > {sub_name}")
            return None
            
        except Exception as e:
            log(f"JSONC 단위 정보 조회 오류: {str(e)}", "ERROR")
            return None

    def _build_included_categories_cache(self):
        """JSONC 파일에서 주석 처리되지 않은 항목만 캐싱합니다."""
        included_cache = {}
        
        try:
            json_data = UNIT_DATA_FROM_JSONC
            
            for major_name, major_data in json_data.items():
                if major_name not in included_cache:
                    included_cache[major_name] = {}
                
                for middle_name, middle_data in major_data.items():
                    if middle_name not in included_cache[major_name]:
                        included_cache[major_name][middle_name] = []
                    
                    # 중분류 데이터가 딕셔너리인 경우에만 처리
                    if isinstance(middle_data, dict):
                        for sub_name in middle_data.keys():
                            included_cache[major_name][middle_name].append(sub_name)
            
            log(f"JSONC 포함 항목 캐싱 완료: {sum(len(subs) for subs in included_cache.values())}개 소분류")
            return included_cache
            
        except Exception as e:
            log(f"JSONC 포함 항목 캐싱 오류: {str(e)}", "ERROR")
            return {}

    def _is_subcategory_included_in_jsonc(self, major_name, middle_name, sub_name):
        """JSONC 파일에서 해당 소분류가 주석 처리되지 않고 포함되어 있는지 확인합니다."""
        try:
            # 이미 캐싱된 전역 데이터 사용
            json_data = UNIT_DATA_FROM_JSONC
            
            # 대분류 확인
            if major_name not in json_data:
                log(f"[DEBUG] JSONC에 대분류 '{major_name}' 없음")
                return False
            
            major_data = json_data[major_name]
            
            # 중분류 확인
            if middle_name not in major_data:
                log(f"[DEBUG] JSONC에 중분류 '{middle_name}' 없음")
                return False
            
            middle_data = major_data[middle_name]
            
            # 소분류 확인
            if sub_name not in middle_data:
                log(f"[DEBUG] JSONC에 소분류 '{sub_name}' 없음")
                return False
            
            # 소분류가 존재하면 포함된 것으로 간주
            log(f"[DEBUG] JSONC에 소분류 '{sub_name}' 포함됨")
            return True
            
        except Exception as e:
            log(f"JSONC 포함 여부 확인 오류: {str(e)}", "ERROR")
            return False

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
        semaphore = asyncio.Semaphore(1)  # 최대 1개 동시 처리로 감소

        async def process_spec_with_new_page(spec):
            async with semaphore:
                try:
                    # 새로운 페이지 생성 (새 탭 방식)
                    new_page = await self.context.new_page()
                    # 전달받은 sub_url 사용 (이미 올바른 형식으로 구성됨)
                    await new_page.goto(sub_url, wait_until='networkidle')
                    await new_page.wait_for_load_state(
                        'networkidle', timeout=60000)
                    await new_page.wait_for_selector(
                        'body', timeout=5000)

                    # '물가추이 보기' 탭으로 이동 (개선된 재시도 로직)
                    for retry in range(5):
                        try:
                            # 실제 HTML 구조에 맞는 셀렉터들 (사용자 제공 구조 기반)
                            selectors = [
                                'a[href*="detail_change.asp"] span:has-text("물가추이 보기")',
                                'a[href*="detail_change.asp"]:has-text("물가추이 보기")',
                                'a[href*="detail_change.asp"]',
                                'a:has-text("물가추이 보기")',
                                'text=물가추이 보기',
                                'a:contains("물가추이")',
                                '.tab-menu a:has-text("물가추이")',
                                'ul.tab-list a:has-text("물가추이")'
                            ]
                            
                            clicked = False
                            for selector in selectors:
                                try:
                                    # 페이지 로딩 상태 확인
                                    await new_page.wait_for_load_state('domcontentloaded', timeout=10000)
                                    
                                    # 셀렉터 대기 및 클릭
                                    await new_page.wait_for_selector(selector, timeout=20000)
                                    await new_page.click(selector, timeout=60000)
                                    clicked = True
                                    log(f"    ✅ 물가추이 보기 탭 클릭 성공 (셀렉터: {selector})")
                                    break
                                except Exception as click_error:
                                    log(f"    ⚠️ 셀렉터 {selector} 클릭 실패: {str(click_error)}")
                                    continue
                            
                            if not clicked:
                                # 디버깅: 페이지의 실제 HTML 구조 확인
                                try:
                                    # 모든 링크 요소 찾기
                                    all_links = await new_page.query_selector_all('a')
                                    log(f"    🔍 디버깅: 페이지에서 발견된 총 링크 수: {len(all_links)}")
                                    
                                    # 물가추이 관련 링크 찾기
                                    price_trend_links = []
                                    for link in all_links:
                                        try:
                                            href = await link.get_attribute('href')
                                            text = await link.inner_text()
                                            if href and ('detail_change' in href or '물가추이' in text):
                                                price_trend_links.append(f"href='{href}', text='{text.strip()}'")
                                        except Exception:
                                            continue
                                    
                                    if price_trend_links:
                                        log(f"    🔍 발견된 물가추이 관련 링크들:")
                                        for link_info in price_trend_links[:5]:  # 최대 5개만 출력
                                            log(f"      - {link_info}")
                                    else:
                                        log(f"    🔍 물가추이 관련 링크를 찾을 수 없음")
                                        
                                    # 현재 페이지 URL 확인
                                    current_url = new_page.url
                                    log(f"    🔍 현재 페이지 URL: {current_url}")
                                    
                                except Exception as debug_error:
                                    log(f"    🔍 디버깅 중 오류: {str(debug_error)}")
                                
                                # 기존 방식으로 재시도 (로그인 상태 확인 포함)
                                try:
                                    # 로그인 상태 확인
                                    login_check = await new_page.query_selector('a[href*="logout"]')
                                    if not login_check:
                                        log(f"    ⚠️ 로그인 상태 확인 실패 - 재로그인 필요할 수 있음")
                                    
                                    link_name = '물가추이 보기'
                                    link_locator = new_page.get_by_role('link', name=link_name)
                                    await link_locator.click(timeout=60000)
                                    clicked = True
                                    log(f"    ✅ 물가추이 보기 탭 클릭 성공 (기존 방식)")
                                except Exception as fallback_error:
                                    log(f"    ❌ 기존 방식 클릭도 실패: {str(fallback_error)}")
                            
                            if clicked:
                                await new_page.wait_for_selector("#ITEM_SPEC_CD", timeout=60000)
                                break
                            else:
                                raise Exception("모든 셀렉터로 물가추이 보기 탭을 찾을 수 없음")
                        except Exception as e:
                            if retry == 4:
                                raise e
                            log(f"    ⚠️ 물가추이 보기 탭 클릭 재시도 {retry + 1}/5: {e}", "WARNING")
                            await asyncio.sleep(5)
                            await new_page.reload()
                            await new_page.wait_for_load_state('domcontentloaded', timeout=30000)
                            await new_page.wait_for_load_state('networkidle', timeout=60000)

                    # 임시 데이터 구조
                    temp_data = {
                        'major_category_name': major_name,
                        'middle_category_name': middle_name,
                        'sub_category_name': sub_name,
                        'spec_data': []
                    }

                    # 규격 처리
                    await self._process_single_spec(new_page, spec, temp_data)

                    # 페이지를 풀에 반환
                    try:
                        await self._return_page_to_pool(new_page)
                    except Exception as return_error:
                        log(f"페이지 풀 반환 실패: {return_error}")
                        try:
                            await new_page.close()
                        except:
                            pass
                    return temp_data['spec_data']

                except Exception as e:
                    error_msg = (f"    - 병렬 처리 중 규격 '{spec['name']}' 오류 "
                                f"[대분류: {major_name}, 중분류: {middle_name}, "
                                f"소분류: {sub_name}]: {str(e)}")
                    log(error_msg)
                    # 예외 발생 시에도 페이지를 풀에 반환
                    try:
                        await self._return_page_to_pool(new_page)
                    except Exception as return_error:
                        log(f"예외 처리 중 페이지 풀 반환 실패: {return_error}")
                        try:
                            await new_page.close()
                        except:
                            pass
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
    # 로그 파일 설정
    log_file_path = "c:\\JAJE\\materials-dashboard\\crawler\\kpi_crawler_debug.log"
    log("DEBUG: main 함수 시작 (kpi_crawler.py)", "DEBUG")
    log(f"DEBUG: 로그 파일 경로: {log_file_path}", "DEBUG")
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
    
    target_major = args.get('target-major') or args.get('major')
    target_middle = args.get('target-middle') or args.get('middle')
    target_sub = args.get('target-sub') or args.get('sub')
    crawl_mode = args.get('crawl-mode') or args.get('mode', 'all')
    start_year = args.get('start-year', '2020')
    start_month = args.get('start-month', '01').zfill(2)
    
    # 캐시 우회 옵션 파싱
    force_refresh = (args.get('force-refresh') or args.get('no-cache') or 
                    args.get('force_refresh') or args.get('no_cache') or False)
    if isinstance(force_refresh, str):
        force_refresh = force_refresh.lower() in ['true', '1', 'yes', 'on']

    log(f"크롤링 설정:")
    log(f"  - 모드: {crawl_mode}")
    log(f"  - 대분류: {target_major}")
    log(f"  - 중분류: {target_middle}")
    log(f"  - 소분류: {target_sub}")
    log(f"  - 시작 시점: {start_year}-{start_month}")
    log(f"  - 캐시 우회: {force_refresh}")

    # 크롤링 모드에 따른 실행
    if crawl_mode == "all" and not target_major:
        # 전체 대분류 크롤링 (기존 방식)
        log("전체 대분류를 크롤링합니다.", "INFO")
        all_major_categories = list(INCLUSION_LIST.keys())
        log(f"크롤링할 대분류: {all_major_categories}", "INFO")
        
        for major in all_major_categories:
            log(f"=== {major} 크롤링 시작 ===", "SUMMARY")
            crawler = KpiCrawler(target_major=major, crawl_mode="all", 
                               start_year=start_year, start_month=start_month,
                               force_refresh=force_refresh)
            await crawler.run()
            log(f"🟢 {major} 크롤링 완료", "SUCCESS")
        
        log("🟢 전체 대분류 크롤링 완료", "SUCCESS")
    elif crawl_mode == "sub_only" and target_sub:
        # sub_only 모드: 특정 소분류만 크롤링
        log(f"=== sub_only 모드: '{target_sub}' 소분류만 크롤링 ===", "SUMMARY")
        
        # JSONC에서 해당 소분류가 속한 대분류와 중분류 찾기
        found_major = None
        found_middle = None
        
        for major, major_data in INCLUSION_LIST.items():
            for middle, middle_data in major_data.items():
                if target_sub in middle_data:
                    found_major = major
                    found_middle = middle
                    break
            if found_major:
                break
        
        if found_major and found_middle:
            log(f"소분류 '{target_sub}'를 찾았습니다: {found_major} > {found_middle} > {target_sub}")
            crawler = KpiCrawler(
                target_major=found_major,
                target_middle=found_middle,
                target_sub=target_sub,
                crawl_mode=crawl_mode,
                start_year=start_year,
                start_month=start_month,
                force_refresh=force_refresh
            )
            await crawler.run()
            log(f"🟢 sub_only 모드 크롤링 완료", "SUCCESS")
        else:
            log(f"❌ 소분류 '{target_sub}'를 JSONC 파일에서 찾을 수 없습니다.", "ERROR")
            return
    else:
        # 선택적 크롤링
        log(f"=== {crawl_mode} 모드 크롤링 시작 ===", "SUMMARY")
        crawler = KpiCrawler(
            target_major=target_major,
            target_middle=target_middle,
            target_sub=target_sub,
            crawl_mode=crawl_mode,
            start_year=start_year,
            start_month=start_month,
            force_refresh=force_refresh
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
                    sub_info = {'name': sub, 'code': f'{major}{middle}{sub}'}
                    sub_url = f"https://www.kpi.or.kr/www/price/detail.asp?CATE_CD={sub_info['code']}"
                    if len(sub_info['code']) >= 4:
                        item_cd = sub_info['code'][-4:]
                        sub_url += f"&ITEM_CD={item_cd}"
                    
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
    log("DEBUG: if __name__ == \"__main__\" 블록 진입 (kpi_crawler.py)", "DEBUG")
    # 명령행 인수 확인
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        # 단위 추출 테스트 실행
        asyncio.run(test_unit_extraction())
    else:
        # 일반 크롤링 실행
        # 프로세스 감지 로직 비활성화 (임시)
        # running_crawlers = check_running_crawler()
        # if running_crawlers:
        #     log(f"이미 실행 중인 크롤러 {len(running_crawlers)}개 발견. 기존 크롤러 완료 후 재실행하세요.", "ERROR")
        #     sys.exit(1)
        
        # 기본 크롤링 실행 (전체 대분류)
        
        asyncio.run(main())
