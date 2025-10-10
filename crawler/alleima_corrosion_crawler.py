import requests
from bs4 import BeautifulSoup
import json
import csv
import time
import re
from urllib.parse import urljoin, urlparse
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AlleimaCorrosionCrawler:
    def __init__(self):
        self.base_url = "https://www.alleima.com"
        self.main_url = "https://www.alleima.com/en/technical-center/corrosion-tables/"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.chemical_links = []
        self.symbol_clarification = {}
        self.corrosion_data = []
        
    def get_chemical_links(self):
        """메인 페이지에서 화학물질별 링크 목록을 추출합니다."""
        try:
            logger.info(f"메인 페이지 접속: {self.main_url}")
            response = self.session.get(self.main_url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # A-Z 섹션에서 화학물질 링크 추출
            a_z_letters = soup.find_all('div', class_='a-z-letter')
            
            for letter_section in a_z_letters:
                letter = letter_section.find('h2')
                if letter:
                    letter_text = letter.get_text().strip()
                    logger.info(f"처리 중인 알파벳: {letter_text}")
                
                links = letter_section.find_all('a', href=True)
                for link in links:
                    href = link.get('href')
                    chemical_name = link.get_text().strip()
                    
                    # 상대 URL을 절대 URL로 변환
                    if href.startswith('/'):
                        full_url = self.base_url + href
                    elif href.startswith('http'):
                        full_url = href
                    else:
                        full_url = urljoin(self.main_url, href)
                    
                    self.chemical_links.append({
                        'name': chemical_name,
                        'url': full_url,
                        'letter': letter_text if letter else 'Unknown'
                    })
            
            logger.info(f"총 {len(self.chemical_links)}개의 화학물질 링크를 찾았습니다.")
            return self.chemical_links
            
        except Exception as e:
            logger.error(f"화학물질 링크 추출 중 오류 발생: {e}")
            return []
    
    def get_symbol_clarification(self, url):
        """Symbol Clarification 테이블 정보를 추출합니다."""
        try:
            logger.info(f"Symbol Clarification 추출 중: {url}")
            response = self.session.get(url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Symbol Clarification 테이블 찾기
            clarification_table = soup.find('table', class_='corrosion-clarification')
            
            if clarification_table:
                rows = clarification_table.find('tbody').find_all('tr')
                
                for row in rows:
                    cells = row.find_all('td')
                    if len(cells) >= 2:
                        symbol = cells[0].get_text().strip()
                        description = cells[1].get_text().strip()
                        
                        # HTML 태그 제거
                        symbol = re.sub(r'<[^>]+>', '', symbol)
                        description = re.sub(r'<[^>]+>', '', description)
                        
                        self.symbol_clarification[symbol] = description
                
                logger.info(f"Symbol Clarification {len(self.symbol_clarification)}개 항목 추출 완료")
                return True
            else:
                logger.warning("Symbol Clarification 테이블을 찾을 수 없습니다.")
                return False
                
        except Exception as e:
            logger.error(f"Symbol Clarification 추출 중 오류 발생: {e}")
            return False
    
    def extract_corrosion_data(self, chemical_info):
        """개별 화학물질 페이지에서 부식 데이터를 추출합니다."""
        try:
            logger.info(f"부식 데이터 추출 중: {chemical_info['name']}")
            response = self.session.get(chemical_info['url'])
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # corrosion-compare 클래스 테이블 찾기
            corrosion_table = soup.find('table', class_='corrosion-compare')
            
            if corrosion_table:
                rows = corrosion_table.find_all('tr')
                
                if len(rows) >= 3:  # 최소 3행 필요 (농도, 온도, 재질 정보)
                    # 첫 번째 행: 농도 정보
                    concentration_row = rows[0]
                    concentration_cells = concentration_row.find_all(['th', 'td'])
                    concentrations = [cell.get_text().strip() for cell in concentration_cells[1:]]  # 첫 번째 셀 제외
                    
                    # 두 번째 행: 온도 정보
                    temperature_row = rows[1]
                    temperature_cells = temperature_row.find_all(['th', 'td'])
                    temperatures = [cell.get_text().strip() for cell in temperature_cells[1:]]  # 첫 번째 셀 제외
                    
                    # 세 번째 행부터: 재질별 부식 등급
                    for i, row in enumerate(rows[2:], start=2):
                        cells = row.find_all(['td', 'th'])
                        if len(cells) > 1:
                            material_name = cells[0].get_text().strip()
                            
                            if material_name:  # 재질명이 있는 경우만
                                corrosion_ratings = []
                                
                                for j, cell in enumerate(cells[1:]):
                                    if j < len(concentrations) and j < len(temperatures):
                                        rating = cell.get_text().strip()
                                        cell_class = cell.get('class', [])
                                        
                                        corrosion_ratings.append({
                                            'concentration': concentrations[j] if j < len(concentrations) else '',
                                            'temperature': temperatures[j] if j < len(temperatures) else '',
                                            'rating': rating,
                                            'cell_class': cell_class
                                        })
                                
                                # 데이터 저장
                                material_data = {
                                    'chemical': chemical_info['name'],
                                    'chemical_url': chemical_info['url'],
                                    'material': material_name,
                                    'corrosion_ratings': corrosion_ratings
                                }
                                
                                self.corrosion_data.append(material_data)
                
                logger.info(f"{chemical_info['name']}: {len([d for d in self.corrosion_data if d['chemical'] == chemical_info['name']])}개 재질 데이터 추출")
            else:
                logger.warning(f"{chemical_info['name']}: corrosion-compare 테이블을 찾을 수 없습니다.")
            
            # 페이지 간 요청 간격
            time.sleep(1)
            return True
            
        except Exception as e:
            logger.error(f"부식 데이터 추출 중 오류 발생 ({chemical_info['name']}): {e}")
            return False
    
    def save_to_json(self, filename):
        """추출된 데이터를 JSON 파일로 저장합니다."""
        try:
            data = {
                'symbol_clarification': self.symbol_clarification,
                'chemical_links': self.chemical_links,
                'corrosion_data': self.corrosion_data,
                'metadata': {
                    'source': self.main_url,
                    'total_chemicals': len(self.chemical_links),
                    'total_data_rows': len(self.corrosion_data),
                    'crawl_date': time.strftime('%Y-%m-%d %H:%M:%S')
                }
            }
            
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"데이터가 {filename}에 저장되었습니다.")
            return True
            
        except Exception as e:
            logger.error(f"JSON 저장 중 오류 발생: {e}")
            return False
    
    def save_to_csv(self, filename):
        """추출된 데이터를 CSV 파일로 저장합니다."""
        try:
            with open(filename, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                
                # 헤더 작성
                writer.writerow(['chemical', 'chemical_url', 'row_data'])
                
                # 데이터 작성
                for item in self.corrosion_data:
                    row_data_str = json.dumps(item['data'], ensure_ascii=False)
                    writer.writerow([item['chemical'], item['chemical_url'], row_data_str])
            
            logger.info(f"데이터가 {filename}에 저장되었습니다.")
            return True
            
        except Exception as e:
            logger.error(f"CSV 저장 중 오류 발생: {e}")
            return False
    
    def crawl_all(self, max_chemicals=None):
        """전체 크롤링 프로세스를 실행합니다."""
        logger.info("Alleima 부식 데이터 크롤링을 시작합니다.")
        
        # 1. 화학물질 링크 목록 추출
        if not self.get_chemical_links():
            logger.error("화학물질 링크 추출에 실패했습니다.")
            return False
        
        # 2. 첫 번째 화학물질에서 Symbol Clarification 추출
        if self.chemical_links and not self.get_symbol_clarification(self.chemical_links[0]['url']):
            logger.warning("Symbol Clarification 추출에 실패했습니다.")
        
        # 3. 각 화학물질별 부식 데이터 추출
        chemicals_to_process = self.chemical_links[:max_chemicals] if max_chemicals else self.chemical_links
        
        for i, chemical_info in enumerate(chemicals_to_process, 1):
            logger.info(f"진행률: {i}/{len(chemicals_to_process)} - {chemical_info['name']}")
            self.extract_corrosion_data(chemical_info)
        
        logger.info("크롤링이 완료되었습니다.")
        return True

def main():
    crawler = AlleimaCorrosionCrawler()
    
    # 전체 화학물질에 대해 크롤링 실행
    if crawler.crawl_all():  # max_chemicals 제거하여 전체 크롤링
        # JSON 파일로 저장
        crawler.save_to_json('../src/data/alleima_corrosion_data_full.json')
        
        print("크롤링이 성공적으로 완료되었습니다!")
        print(f"화학물질 수: {len(crawler.chemical_links)}")
        print(f"Symbol Clarification 항목 수: {len(crawler.symbol_clarification)}")
        print(f"부식 데이터 행 수: {len(crawler.corrosion_data)}")
    else:
        print("크롤링 중 오류가 발생했습니다.")

if __name__ == "__main__":
    main()