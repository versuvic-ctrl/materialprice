import asyncio
import os
import sys
import json
import re
from datetime import datetime
from playwright.async_api import async_playwright
from data_processor import create_data_processor, log

# --- 1. 상수 및 설정 ---
BASE_URL = "https://www.kpi.or.kr"
LOGIN_URL = f"{BASE_URL}/www/selectBbsNttList.do?bbsNo=438"
CATEGORY_URL = f"{BASE_URL}/www/price/category.asp"

# 크롤링 대상 대분류 설정 (INCLUSION_LIST)
# 키: 대분류명, 값: 포함할 소분류 키워드 리스트 (비어있으면 전체)
INCLUSION_LIST = {
    "토목자재": ["관류", "철강", "골재"],
    "건축자재": ["시멘트", "콘크리트", "벽돌", "목재"],
    "기계설비자재": ["배관", "밸브", "보일러"],
    "전기통신자재": ["전선", "조명", "배선"],
}

# --- 2. KpiCrawler 클래스 정의 ---
class KpiCrawler:
    def __init__(self, target_major=None, crawl_mode="all", start_year="2023", start_month="01"):
        self.target_major = target_major
        self.crawl_mode = crawl_mode
        self.start_year = start_year
        self.start_month = start_month
        self.processor = create_data_processor('kpi')
        self.browser = None
        self.context = None
        self.page = None

    async def init_browser(self):
        """브라우저 및 컨텍스트 초기화 (세션 관리 포함)"""
        playwright = await async_playwright().start()
        # 가시적인 확인을 위해 headless=False 권장 (운영 시 True)
        self.browser = await playwright.chromium.launch(headless=True)
        
        # auth.json 존재 여부 확인 및 세션 로드
        storage_state = "auth.json" if os.path.exists("auth.json") else None
        self.context = await self.browser.new_context(storage_state=storage_state)
        self.page = await self.context.new_page()

    async def login(self):
        """로그인 처리 및 세션 저장"""
        log("로그인 페이지로 이동 중...")
        await self.page.goto(LOGIN_URL)
        
        # 이미 로그인되어 있는지 확인 (로그아웃 버튼 존재 여부 등)
        is_logged_in = await self.page.query_selector("text=로그아웃")
        if is_logged_in:
            log("이미 로그인되어 있습니다.", "SUCCESS")
            return True

        # 환경 변수에서 계정 정보 로드
        user_id = os.environ.get("KPI_USER_ID")
        user_pw = os.environ.get("KPI_USER_PW")
        
        if not user_id or not user_pw:
            log("KPI_USER_ID 또는 KPI_USER_PW 환경 변수가 설정되지 않았습니다.", "ERROR")
            return False

        await self.page.fill("#userId", user_id)
        await self.page.fill("#userPw", user_pw)
        await self.page.click("text=로그인")
        await self.page.wait_for_load_state("networkidle")

        # 로그인 성공 확인 및 세션 저장
        if await self.page.query_selector("text=로그아웃"):
            log("로그인 성공! 세션을 저장합니다.", "SUCCESS")
            await self.context.storage_state(path="auth.json")
            return True
        else:
            log("로그인 실패. auth.json을 삭제하고 다시 시도하세요.", "ERROR")
            if os.path.exists("auth.json"):
                os.remove("auth.json")
            return False

    async def run(self):
        """전체 크롤링 프로세스 실행"""
        try:
            await self.init_browser()
            if not await self.login():
                return

            await self._navigate_to_category()
            await self._crawl_data()
            
            # 수집된 데이터 저장
            df = self.processor.to_dataframe()
            if not df.empty:
                log(f"총 {len(df)}건의 데이터를 수집했습니다. DB 저장을 시작합니다.", "SUMMARY")
                self.processor.save_to_supabase(df.to_dict('records'))
            else:
                log("수집된 데이터가 없습니다.", "WARNING")

        finally:
            if self.browser:
                await self.browser.close()

    async def _navigate_to_category(self):
        """카테고리 페이지로 이동 및 팝업 처리"""
        log("카테고리 페이지로 이동 중...")
        await self.page.goto(CATEGORY_URL, wait_until="networkidle")
        
        # 팝업 닫기
        popups = await self.page.query_selector_all(".pop-btn-close")
        for popup in popups:
            if await popup.is_visible():
                await popup.click()
        log("카테고리 페이지 이동 완료", "SUCCESS")

    async def _crawl_data(self):
        """실제 데이터 추출 로직 (추상화된 단계)"""
        # 1. 대분류 목록 가져오기
        # 2. 루프: 대분류 -> 중분류 -> 소분류
        # 3. 소분류 클릭 -> 규격별 가격표 추출
        # 4. processor.add_raw_data() 호출
        log("데이터 추출 로직을 실행합니다... (상세 구현 생략)")
        pass

# --- 5. 메인 실행 함수 ---
async def main():
    """메인 실행 로직: 명령행 인자 파싱 및 크롤러 실행"""
    args = {arg.split('=', 1)[0].strip('-'): arg.split('=', 1)[1].strip('"\'') for arg in sys.argv[1:] if '=' in arg}
    
    target_major = args.get('major')
    crawl_mode = "major_only" if target_major else "all"
    
    start_year = args.get('start-year', '2023')
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
