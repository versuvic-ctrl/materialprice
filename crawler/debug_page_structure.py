import requests
from bs4 import BeautifulSoup
import json

def debug_page_structure():
    """Acetic acid 페이지의 HTML 구조를 분석합니다."""
    url = "https://www.alleima.com/en/technical-center/corrosion-tables/acetic-acid/"
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    })
    
    try:
        response = session.get(url)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        print("=== 페이지 제목 ===")
        title = soup.find('title')
        if title:
            print(title.get_text().strip())
        
        print("\n=== 모든 테이블 찾기 ===")
        tables = soup.find_all('table')
        print(f"총 {len(tables)}개의 테이블을 찾았습니다.")
        
        for i, table in enumerate(tables):
            print(f"\n--- 테이블 {i+1} ---")
            print(f"클래스: {table.get('class', [])}")
            
            # 헤더 확인
            headers = table.find_all('th')
            if headers:
                print("헤더:")
                for j, header in enumerate(headers):
                    print(f"  {j+1}: {header.get_text().strip()}")
            
            # 첫 번째 몇 행 확인
            rows = table.find_all('tr')
            print(f"총 {len(rows)}개의 행")
            
            for j, row in enumerate(rows[:3]):  # 처음 3행만
                cells = row.find_all(['td', 'th'])
                if cells:
                    print(f"  행 {j+1}: {[cell.get_text().strip() for cell in cells]}")
        
        print("\n=== 특정 클래스 요소 찾기 ===")
        
        # 부식 관련 클래스 찾기
        corrosion_elements = soup.find_all(class_=lambda x: x and 'corrosion' in str(x).lower())
        print(f"부식 관련 클래스 요소: {len(corrosion_elements)}개")
        
        for elem in corrosion_elements[:5]:  # 처음 5개만
            print(f"  태그: {elem.name}, 클래스: {elem.get('class')}, 텍스트: {elem.get_text().strip()[:50]}")
        
        print("\n=== div 요소 중 table 포함하는 것 찾기 ===")
        divs_with_tables = soup.find_all('div', lambda tag: tag.find('table'))
        print(f"테이블을 포함한 div: {len(divs_with_tables)}개")
        
        for i, div in enumerate(divs_with_tables[:3]):
            print(f"  div {i+1} 클래스: {div.get('class', [])}")
            tables_in_div = div.find_all('table')
            print(f"    포함된 테이블 수: {len(tables_in_div)}")
        
        # HTML 일부를 파일로 저장
        with open('debug_page_content.html', 'w', encoding='utf-8') as f:
            f.write(str(soup.prettify()))
        
        print("\n페이지 내용이 debug_page_content.html에 저장되었습니다.")
        
    except Exception as e:
        print(f"오류 발생: {e}")

if __name__ == "__main__":
    debug_page_structure()