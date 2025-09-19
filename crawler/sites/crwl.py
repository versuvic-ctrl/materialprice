import asyncio
import pandas as pd
from playwright.async_api import async_playwright
import re
from datetime import datetime
import json

class KPIPlaywrightCrawler:
    def __init__(self):
        self.browser = None
        self.page = None
        self.base_url = "https://www.kpi.or.kr/www/price/category.asp"
        self.data = []
        
    async def setup_browser(self, headless=True):
        """브라우저 설정"""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=headless,
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        
        context = await self.browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )
        self.page = await context.new_page()
        
        # 페이지 로딩 타임아웃 설정
        self.page.set_default_timeout(30000)
        
    async def get_categories(self):
        """대분류, 중분류 카테고리 수집"""
        await self.page.goto(self.base_url)
        await self.page.wait_for_load_state('networkidle')
        
        categories = {}
        
        # 대분류 수집
        major_buttons = await self.page.query_selector_all('.dep-one .nt-list dt button')
        
        for i, button in enumerate(major_buttons):
            # 대분류 이름 가져오기
            major_dt = await button.query_selector('xpath=..')
            major_name = await major_dt.text_content()
            major_name = major_name.replace('열기', '').strip()
            
            # 대분류 클릭
            await button.click()
            await self.page.wait_for_timeout(1000)
            
            # 중분류 링크 수집
            mid_links = await self.page.query_selector_all('.dep-one .nt-list dd ul li a')
            categories[major_name] = []
            
            for link in mid_links:
                mid_name = await link.text_content()
                mid_url = await link.get_attribute('href')
                if mid_url:
                    # 상대 경로를 절대 경로로 변환
                    if mid_url.startswith('/'):
                        mid_url = 'https://www.kpi.or.kr' + mid_url
                    
                    categories[major_name].append({
                        'name': mid_name.strip(),
                        'url': mid_url
                    })
        
        return categories
    
    async def get_sub_categories(self, mid_category_url):
        """중분류에서 소분류 수집"""
        await self.page.goto(mid_category_url)
        await self.page.wait_for_load_state('networkidle')
        
        sub_categories = []
        
        try:
            # 소분류 링크 찾기
            sub_links = await self.page.query_selector_all('.dep-three .nt-list dd ul li a')
            for link in sub_links:
                sub_name = await link.text_content()
                sub_url = await link.get_attribute('href')
                
                if sub_url:
                    if sub_url.startswith('/'):
                        sub_url = 'https://www.kpi.or.kr' + sub_url
                    
                    sub_categories.append({
                        'name': sub_name.strip(),
                        'url': sub_url
                    })
        except Exception:
            pass
            
        return sub_categories
    
    async def navigate_to_price_trend(self, sub_category_url):
        """소분류에서 물가추이 보기로 이동"""
        await self.page.goto(sub_category_url)
        await self.page.wait_for_load_state('networkidle')
        
        try:
            # 물가추이 보기 버튼 찾기 및 클릭
            price_trend_selector = 'li:has-text("물가추이 보기")'
            await self.page.wait_for_selector(price_trend_selector, timeout=10000)
            await self.page.click(price_trend_selector)
            await self.page.wait_for_load_state('networkidle')
            return True
        except Exception as e:
            print(f"물가추이 페이지 이동 실패: {e}")
            return False
    
    async def get_specifications(self):
        """규격 선택 옵션들 수집"""
        specifications = []
        
        try:
            # 규격 선택 요소 확인
            spec_select = await self.page.query_selector('#ITEM_SPEC_CD')
            if spec_select:
                options = await spec_select.query_selector_all('option')
                for option in options:
                    value = await option.get_attribute('value')
                    text = await option.text_content()
                    
                    if value and value.strip():  # 빈 값 제외
                        specifications.append({
                            'value': value.strip(),
                            'text': text.strip()
                        })
        except Exception:
            pass
            
        return specifications
    
    async def get_price_conditions(self):
        """가격 조건 정보 추출"""
        conditions = {}
        
        try:
            condition_element = await self.page.query_selector('.price-dd-step')
            if condition_element:
                condition_text = await condition_element.text_content()
                
                # 정규표현식으로 조건 정보 추출
                patterns = {
                    'supply_location': r'수도장소.*?:(.*?)(?=\n|결제조건|거래수량|부가세|$)',
                    'payment_terms': r'결제조건.*?:(.*?)(?=\n|거래수량|부가세|$)',
                    'trade_quantity': r'거래수량.*?:(.*?)(?=\n|부가세|$)',
                    'tax': r'부가세.*?:(.*?)(?=\n|$)'
                }
                
                for key, pattern in patterns.items():
                    match = re.search(pattern, condition_text, re.DOTALL)
                    conditions[key] = match.group(1).strip() if match else ''
                    
        except Exception:
            pass
            
        return conditions
    
    async def set_date_range(self, start_year="2000"):
        """조회 기간 설정"""
        try:
            # 시작 연도 설정
            year_select = await self.page.query_selector('#DATA_YEAR_F')
            if year_select:
                await self.page.select_option('#DATA_YEAR_F', start_year)
                await self.page.wait_for_timeout(1000)
            
            # 시작 월 설정 (있다면)
            month_select = await self.page.query_selector('#DATA_MONTH_F')
            if month_select:
                await self.page.select_option('#DATA_MONTH_F', '1')
                await self.page.wait_for_timeout(1000)
                
            return True
        except Exception:
            return False
    
    async def extract_price_data(self, major_cat, mid_cat, sub_cat, spec_info):
        """가격 데이터 추출"""
        try:
            # 테이블이 로드될 때까지 대기
            await self.page.wait_for_selector('#priceTrendDataArea', timeout=10000)
            
            # 테이블 데이터 추출
            table_data = await self.page.evaluate('''
                () => {
                    const table = document.querySelector('#priceTrendDataArea');
                    if (!table) return null;
                    
                    const rows = Array.from(table.querySelectorAll('tr'));
                    if (rows.length < 2) return null;
                    
                    // 헤더 추출
                    const headers = Array.from(rows[0].querySelectorAll('th')).map(th => th.textContent.trim());
                    const regions = headers.slice(1); // 첫 번째 '구분' 제외
                    
                    // 데이터 행 추출
                    const dataRows = [];
                    for (let i = 1; i < rows.length; i++) {
                        const cells = Array.from(rows[i].querySelectorAll('td'));
                        if (cells.length < 2) continue;
                        
                        const date = cells[0].textContent.trim();
                        const prices = cells.slice(1).map(cell => cell.textContent.trim().replace(/,/g, ''));
                        
                        dataRows.push({ date, prices });
                    }
                    
                    return { regions, dataRows };
                }
            ''')
            
            if not table_data:
                return
            
            # 가격 조건 정보
            conditions = await self.get_price_conditions()
            
            # 각 지역별 데이터 저장
            for row_data in table_data['dataRows']:
                date_str = row_data['date']
                prices = row_data['prices']
                
                for i, region in enumerate(table_data['regions']):
                    if i < len(prices) and prices[i]:
                        try:
                            price_value = int(prices[i]) if prices[i].isdigit() else None
                        except (ValueError, TypeError):
                            price_value = None
                            
                        self.data.append({
                            'major_category': major_cat,
                            'mid_category': mid_cat['name'],
                            'sub_category': sub_cat['name'],
                            'specification': spec_info['text'],
                            'spec_value': spec_info['value'],
                            'region': region,
                            'date': date_str,
                            'price': price_value,
                            'supply_location': conditions.get('supply_location', ''),
                            'payment_terms': conditions.get('payment_terms', ''),
                            'trade_quantity': conditions.get('trade_quantity', ''),
                            'tax': conditions.get('tax', ''),
                            'crawled_at': datetime.now().isoformat()
                        })
                        
        except Exception as e:
            print(f"가격 데이터 추출 오류: {e}")
    
    async def crawl_all_data(self, headless=True):
        """전체 데이터 크롤링"""
        await self.setup_browser(headless)
        
        try:
            print("카테고리 구조 분석 중...")
            categories = await self.get_categories()
            
            total_items = sum(len(mid_cats) for mid_cats in categories.values())
            processed_items = 0
            
            for major_cat, mid_categories in categories.items():
                print(f"\n대분류 처리 중: {major_cat}")
                
                for mid_cat in mid_categories:
                    print(f"  중분류 처리 중: {mid_cat['name']}")
                    
                    # 소분류 수집
                    sub_categories = await self.get_sub_categories(mid_cat['url'])
                    
                    if not sub_categories:
                        sub_categories = [{'name': mid_cat['name'], 'url': mid_cat['url']}]
                    
                    for sub_cat in sub_categories:
                        print(f"    소분류 처리 중: {sub_cat['name']}")
                        
                        # 물가추이 페이지로 이동
                        if not await self.navigate_to_price_trend(sub_cat['url']):
                            continue
                        
                        # 규격 정보 수집
                        specifications = await self.get_specifications()
                        
                        if not specifications:
                            specifications = [{'value': '', 'text': '기본'}]
                        
                        # 각 규격별 데이터 수집
                        for spec in specifications:
                            print(f"      규격 처리 중: {spec['text'][:50]}...")
                            
                            try:
                                # 규격 선택
                                if spec['value']:
                                    await self.page.select_option('#ITEM_SPEC_CD', spec['value'])
                                    await self.page.wait_for_timeout(2000)
                                
                                # 조회 기간 설정
                                await self.set_date_range("2000")
                                
                                # 조회 버튼 클릭 (있다면)
                                search_button = await self.page.query_selector('input[type="submit"][value*="조회"], input[type="button"][value*="조회"], input[type="submit"][value*="검색"]')
                                if search_button:
                                    await search_button.click()
                                    await self.page.wait_for_load_state('networkidle')
                                
                                # 데이터 추출
                                await self.extract_price_data(major_cat, mid_cat, sub_cat, spec)
                                
                                # 요청 간격
                                await self.page.wait_for_timeout(1000)
                                
                            except Exception as e:
                                print(f"        오류 발생: {str(e)}")
                                continue
                    
                    processed_items += 1
                    progress = processed_items / total_items * 100
                    print(f"  진행률: {processed_items}/{total_items} ({progress:.1f}%)")
            
            print(f"\n크롤링 완료! 총 {len(self.data)}개 데이터 수집")
            
        finally:
            await self.cleanup()
    
    async def cleanup(self):
        """브라우저 정리"""
        if self.browser:
            await self.browser.close()
        if hasattr(self, 'playwright'):
            await self.playwright.stop()
    
    def save_data(self, filename="kpi_price_data.csv"):
        """데이터를 CSV로 저장"""
        if self.data:
            df = pd.DataFrame(self.data)
            df.to_csv(filename, index=False, encoding='utf-8-sig')
            print(f"데이터가 {filename}에 저장되었습니다.")
            return df
        else:
            print("저장할 데이터가 없습니다.")
            return None
    
    def save_json(self, filename="kpi_price_data.json"):
        """데이터를 JSON으로 저장"""
        if self.data:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, ensure_ascii=False, indent=2)
            print(f"JSON 데이터가 {filename}에 저장되었습니다.")
    
    def get_summary(self):
        """수집된 데이터 요약"""
        if not self.data:
            return "수집된 데이터가 없습니다."
        
        df = pd.DataFrame(self.data)
        summary = {
            'total_records': len(df),
            'major_categories': df['major_category'].nunique(),
            'mid_categories': df['mid_category'].nunique(), 
            'sub_categories': df['sub_category'].nunique(),
            'specifications': df['specification'].nunique(),
            'regions': df['region'].nunique(),
            'date_range': f"{df['date'].min()} ~ {df['date'].max()}"
        }
        return summary

# 사용 예시
async def main():
    crawler = KPIPlaywrightCrawler()
    
    # 전체 데이터 크롤링
    await crawler.crawl_all_data(headless=False)  # headless=False로 브라우저 보기
    
    # 데이터 저장
    df = crawler.save_data("kpi_price_data.csv")
    crawler.save_json("kpi_price_data.json")
    
    # 요약 정보 출력
    summary = crawler.get_summary()
    print("\n=== 수집 결과 요약 ===")
    for key, value in summary.items():
        print(f"{key}: {value}")

if __name__ == "__main__":
    # Playwright 설치: pip install playwright pandas
    # 브라우저 설치: playwright install
    asyncio.run(main())