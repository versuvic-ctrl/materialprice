import requests
from bs4 import BeautifulSoup
import json

import time
import re
from urllib.parse import urljoin
import logging

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AlleimaCorrosionCrawlerImproved:
    def __init__(self):
        self.base_url = "https://www.alleima.com"
        self.main_url = (
            "https://www.alleima.com/en/technical-center/corrosion-tables/"
        )
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                '(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            )
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
            clarification_table = soup.find(
                'table', class_='corrosion-clarification'
            )

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

                logger.info(
                    f"Symbol Clarification "
                    f"{len(self.symbol_clarification)}개 항목 추출 완료"
                )
                return True
            else:
                logger.warning("Symbol Clarification 테이블을 찾을 수 없습니다.")
                return False

        except Exception as e:
            logger.error(f"Symbol Clarification 추출 중 오류 발생: {e}")
            return False
        except Exception as e:
            logger.error(f"Symbol Clarification 추출 중 오류 발생: {e}")
            return False

    def extract_chemical_formulas(self, caption_text):
        """캡션에서 화학식 정보를 추출합니다."""
        chemical_formulas = {}

        # 화학식 패턴 매칭 (예: CH3COOH, HCOOH 등)
        # Extract chemical formulas from caption text
        formula_patterns = re.findall(
            r'([A-Z][a-z]?\d*[A-Z]*[a-z]*\d*[A-Z]*[a-z]*\d*)',
            caption_text
        )
        # Use formula_patterns if needed for future processing
        _ = formula_patterns

        # 화학물질명과 화학식 매핑
        if 'acetic acid' in caption_text.lower() or 'CH3COOH' in caption_text:
            chemical_formulas['Acetic acid'] = 'CH3COOH'
        if 'formic acid' in caption_text.lower() or 'HCOOH' in caption_text:
            chemical_formulas['formic acid'] = 'HCOOH'
        if ('potassium permanganate' in caption_text.lower() or
                'KMnO4' in caption_text):
            chemical_formulas['potassium permanganate'] = 'KMnO4'

        return chemical_formulas

    def extract_corrosion_data(self, chemical_info):
        """개별 화학물질 페이지에서 부식 데이터를 추출합니다."""
        try:
            logger.info(f"부식 데이터 추출 중: {chemical_info['name']}")
            response = self.session.get(chemical_info['url'])
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')

            # 모든 corrosion-compare 테이블 찾기 (페이지에 여러 테이블이 있을 수 있음)
            corrosion_tables = soup.find_all(
                'table', class_='corrosion-compare'
            )

            if corrosion_tables:
                logger.info(
                    f"{chemical_info['name']}: "
                    f"{len(corrosion_tables)}개의 테이블을 찾았습니다."
                )

                for table_index, corrosion_table in enumerate(
                    corrosion_tables
                ):
                    logger.info(
                        f"{chemical_info['name']}: "
                        f"테이블 {table_index + 1}/{len(corrosion_tables)} 처리 중"
                    )
                    self.process_corrosion_table(
                        corrosion_table, chemical_info, table_index
                    )
            else:
                logger.warning(
                    f"{chemical_info['name']}: corrosion-compare 테이블을 "
                    "찾을 수 없습니다."
                )

            # 페이지 간 요청 간격
            time.sleep(1)
            return True

        except Exception as e:
            logger.error(f"부식 데이터 추출 중 오류 발생 ({chemical_info['name']}): {e}")
            return False

    def process_corrosion_table(
        self, corrosion_table, chemical_info, table_index=0
    ):
        """개별 corrosion-compare 테이블을 처리합니다."""
        try:
            # 캡션에서 화학식 정보 추출
            caption = corrosion_table.find('caption')
            chemical_formulas = {}
            if caption:
                caption_text = caption.get_text()
                chemical_formulas = self.extract_chemical_formulas(
                    caption_text)

            # 모든 행 가져오기 (thead와 tbody 모두)
            all_rows = []
            thead = corrosion_table.find('thead')
            tbody = corrosion_table.find('tbody')

            if thead:
                all_rows.extend(thead.find_all('tr'))
            if tbody:
                all_rows.extend(tbody.find_all('tr'))
            else:
                # tbody가 없는 경우 table 직하위 tr들
                all_rows.extend(
                    corrosion_table.find_all('tr', recursive=False)
                )

            if len(all_rows) < 2:
                logger.warning(
                    f"{chemical_info['name']}: 테이블 {table_index + 1} - "
                    "충분한 행이 없습니다."
                )
                return False

            # 농도 행들과 온도 행 식별
            concentration_rows = []
            temperature_row_index = -1
            material_start_index = -1

            for i, row in enumerate(all_rows):
                first_cell = row.find(['th', 'td'])
                if first_cell:
                    cell_text = first_cell.get_text().strip()

                    # 농도 정보 행 식별 (Conc로 시작하거나 Conc.를 포함)
                    if cell_text.startswith('Conc') or 'Conc.' in cell_text:
                        concentration_rows.append({
                            'index': i,
                            'row': row,
                            'chemical_name': cell_text
                        })
                    # 온도 행 식별
                    elif cell_text == 'Temp. °C':
                        temperature_row_index = i
                    # 재질 정보 시작점 식별
                    elif (cell_text in ['Grade or type of alloy:',
                                        'Grade or type of alloy'] and
                          material_start_index == -1):
                        material_start_index = i

            if temperature_row_index == -1:
                logger.warning(
                    f"{chemical_info['name']}: 테이블 {table_index + 1} - "
                    "온도 행을 찾을 수 없습니다."
                )
                return False

            if material_start_index == -1:
                logger.warning(
                    f"{chemical_info['name']}: 테이블 {table_index + 1} - "
                    "재질 정보 시작점을 찾을 수 없습니다."
                )
                return False

            # 농도 데이터 추출
            concentration_data = []
            for conc_info in concentration_rows:
                cells = conc_info['row'].find_all(['th', 'td'])
                values = [
                    cell.get_text().strip()
                    for cell in cells[1:]
                ]  # 첫 번째 셀 제외

                # 농도 정보에서 화학물질명 추출 (예: "Conc .CH3COOH,%" -> "CH3COOH")
                chemical_name = conc_info['chemical_name']
                if 'Conc' in chemical_name:
                    # Conc. 또는 Conc 제거
                    chemical_name = re.sub(r'Conc\.?\s*', '', chemical_name)
                    # 쉼표, %, 공백, 점 제거
                    chemical_name = re.sub(r'[,%.&\s]+', '', chemical_name)
                    # HTML 태그 제거
                    chemical_name = re.sub(r'<[^>]+>', '', chemical_name)

                concentration_data.append({
                    'chemical_name': chemical_name,
                    'values': values
                })

            # 온도 데이터 추출
            temp_row = all_rows[temperature_row_index]
            temp_cells = temp_row.find_all(['th', 'td'])
            temperatures = [
                cell.get_text().strip() for cell in temp_cells[1:]
            ]  # 첫 번째 셀 제외
            # 재질별 부식 등급 추출
            for i in range(material_start_index + 1, len(all_rows)):
                row = all_rows[i]
                cells = row.find_all(['td', 'th'])
                if len(cells) > 1:
                    material_name = cells[0].get_text().strip()
                    # HTML 태그 제거 (링크 등)
                    material_name = re.sub(r'<[^>]+>', '', material_name)
                    if (material_name and
                            material_name not in
                            ['Grade or type of alloy:',
                             'Grade or type of alloy']):
                        corrosion_ratings = []
                        for j, cell in enumerate(cells[1:]):
                            if j < len(temperatures):
                                rating = cell.get_text().strip()
                                cell_class = cell.get('class', [])
                                # 각 농도별 정보 구성
                                concentration_info = {}
                                for k, conc_data in \
                                        enumerate(concentration_data):
                                    if (
                                        j < len(conc_data['values'])
                                        and conc_data['values'][j]
                                    ):
                                        concentration_info[
                                            f'concentration_{k+1}'
                                        ] = {
                                            'chemical':
                                            conc_data['chemical_name'],
                                            'value': conc_data['values'][j]
                                        }
                                # 농도 정보가 없는 경우 기본값 설정
                                if not concentration_info and \
                                        len(concentration_data) == 0:
                                    concentration_info['concentration_1'] = {
                                        'chemical': chemical_info['name'],
                                        'value': ''
                                    }
                                corrosion_ratings.append({
                                    'concentrations': concentration_info,
                                    'temperature': (
                                        temperatures[j]
                                        if j < len(temperatures)
                                        else ''
                                    ),
                                    'rating': rating,
                                    'cell_class': cell_class
                                })
                        # 데이터 저장
                        material_data = {
                            'chemical': chemical_info['name'],
                            'chemical_url': chemical_info['url'],
                            'chemical_formulas': chemical_formulas,
                            'material': material_name,
                            'corrosion_ratings': corrosion_ratings,
                            'table_index': table_index  # 테이블 인덱스 추가
                        }
                        self.corrosion_data.append(material_data)
            extracted_count = len([
                d for d in self.corrosion_data
                if d['chemical'] == chemical_info['name']
                and d.get('table_index') == table_index
            ])
            logger.info(
                f"{chemical_info['name']}: 테이블 {table_index + 1} - "
                f"{extracted_count}개 재질 데이터 추출"
            )
            return True
        except Exception as e:
            logger.error(
                f"테이블 처리 중 오류 발생 "
                f"({chemical_info['name']}, 테이블 {table_index + 1}): {e}"
            )
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

    def crawl_all(self, max_chemicals=None):

        """전체 크롤링 프로세스를 실행합니다."""
        logger.info("Alleima 부식 데이터 크롤링을 시작합니다.")
        # 1. 화학물질 링크 목록 추출
        if not self.get_chemical_links():
            logger.error("화학물질 링크 추출에 실패했습니다.")
            return False
        # 2. 첫 번째 화학물질에서 Symbol Clarification 추출
        if (self.chemical_links and
                not self.get_symbol_clarification(
                    self.chemical_links[0]['url'])):
            logger.warning("Symbol Clarification 추출에 실패했습니다.")
        # 3. 각 화학물질별 부식 데이터 추출
        chemicals_to_process = (
            self.chemical_links[:max_chemicals]
            if max_chemicals
            else self.chemical_links
        )
        for i, chemical_info in enumerate(chemicals_to_process, 1):
            logger.info(
                f"진행률: {i}/{len(chemicals_to_process)} - "
                f"{chemical_info['name']}"
            )
            self.extract_corrosion_data(chemical_info)
        logger.info("크롤링이 완료되었습니다.")
        return True


def main():
    crawler = AlleimaCorrosionCrawlerImproved()
    # 전체 화학물질 크롤링
    if crawler.crawl_all():
        # JSON 파일로 저장
        crawler.save_to_json('../src/data/alleima_corrosion_data_origin.json')
        print("크롤링이 성공적으로 완료되었습니다!")
        print(f"화학물질 수: {len(crawler.chemical_links)}")
        print(
            f"Symbol Clarification 항목 수: "
            f"{len(crawler.symbol_clarification)}"
        )
        print(f"부식 데이터 행 수: {len(crawler.corrosion_data)}")
    else:
        print("크롤링 중 오류가 발생했습니다.")


if __name__ == "__main__":
    main()
