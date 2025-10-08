"""
MakeItFrom 공개 페이지 카테고리 및 물성값 크롤러
4단계 카테고리 구조를 크롤링하고 각 재질의 물성값을 추출합니다: 대분류 > 중분류 > 소분류 > 자재명 > 물성값
"""

import asyncio
import json
import logging
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
import re
from urllib.parse import urljoin

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('public_category_crawler.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class PublicCategoryCrawler:
    def __init__(self):
        self.base_url = "https://www.makeitfrom.com/"
        self.categories_url = "https://www.makeitfrom.com/"
        self.materials_data = []
        
    async def crawl_main_categories(self, page):
        """메인 페이지에서 1단계(대분류) 카테고리를 추출합니다."""
        logger.info("메인 페이지에서 대분류 카테고리를 추출합니다...")
        
        await page.goto(self.base_url, timeout=60000)
        await page.wait_for_load_state('networkidle')
        
        # 대분류 카테고리 추출 (Metals, Polymerics, Ceramics)
        major_categories = {}
        
        # h2 태그로 대분류 찾기
        h2_elements = await page.query_selector_all('h2')
        
        for h2 in h2_elements:
            text = await h2.text_content()
            if text and text.strip() in ['Metals', 'Polymerics', 'Ceramics']: # 모든 대분류 크롤링
                logger.info(f"대분류 발견: {text.strip()}")
                
                # h2 다음의 section에서 중분류 링크 찾기
                section = await h2.evaluate_handle('el => el.nextElementSibling')
                if section:
                    links = await section.query_selector_all('a[href*="/material-group/"]')
                    middle_categories = []
                    
                    for link in links:
                        href = await link.get_attribute('href')
                        link_text = await link.text_content()
                        if href and link_text:
                            middle_categories.append({
                                'name': link_text.strip(),
                                'url': urljoin(self.base_url, href)
                            })
                    
                    major_categories[text.strip()] = middle_categories
                    logger.info(f"{text.strip()}: {len(middle_categories)}개 중분류 발견")
        
        return major_categories
    
    async def crawl_middle_category(self, page, category_name, category_url):
        """중분류 페이지에서 3단계(소분류) 카테고리를 추출합니다."""
        logger.info(f"중분류 '{category_name}' 페이지를 크롤링합니다...")
        
        try:
            await page.goto(category_url)
            await page.wait_for_load_state('networkidle')
            
            # 소분류 링크 찾기
            sub_categories = []
            links = await page.query_selector_all('a[href*="/material-group/"]')
            
            for link in links:
                href = await link.get_attribute('href')
                link_text = await link.text_content()
                if href and link_text:
                    sub_categories.append({
                        'name': link_text.strip(),
                        'url': urljoin(self.base_url, href)
                    })
            
            logger.info(f"'{category_name}': {len(sub_categories)}개 소분류 발견")
            return sub_categories
            
        except Exception as e:
            logger.error(f"중분류 '{category_name}' 크롤링 중 오류: {e}")
            return []

    async def check_if_materials_at_middle_level(self, page, category_name, category_url):
        """중분류 페이지에서 바로 재질 링크가 있는지 확인합니다."""
        logger.info(f"중분류 '{category_name}'에서 재질 링크 확인 중...")
        
        try:
            await page.goto(category_url)
            await page.wait_for_load_state('networkidle')
            
            # 재질 링크 찾기 (/material-properties/ 패턴)
            material_links = await page.query_selector_all('a[href*="/material-properties/"]')
            
            if material_links:
                logger.info(f"'{category_name}': 3단계에서 {len(material_links)}개 재질 발견 (4단계 구조가 아님)")
                materials_info = []
                
                for link in material_links:
                    href = await link.get_attribute('href')
                    link_text = await link.text_content()
                    if href and link_text:
                        full_url = urljoin(self.base_url, href)
                        materials_info.append({
                            'name': link_text.strip(),
                            'url': full_url
                        })
                
                return materials_info
            else:
                logger.info(f"'{category_name}': 3단계에서 재질 없음, 4단계 구조로 진행")
                return None
                
        except Exception as e:
            logger.error(f"중분류 '{category_name}' 재질 확인 중 오류: {e}")
            return None
    
    async def crawl_sub_category(self, page, category_name, category_url):
        """소분류 페이지에서 4단계(세분류/자재명) 카테고리를 추출합니다."""
        logger.info(f"소분류 '{category_name}' 페이지를 크롤링합니다...")
        
        try:
            await page.goto(category_url)
            await page.wait_for_load_state('networkidle')
            
            # 자재명 링크 찾기
            materials = []
            links = await page.query_selector_all('a[href*="/material-properties/"]')
            
            for link in links:
                href = await link.get_attribute('href')
                link_text = await link.text_content()
                if href and link_text:
                    materials.append(link_text.strip())
            
            logger.info(f"'{category_name}': {len(materials)}개 자재 발견")
            return materials
            
        except Exception as e:
            logger.error(f"소분류 '{category_name}' 크롤링 중 오류: {e}")
            return []
    
    async def extract_material_properties(self, page, material_url, material_name):
        """개별 재질 페이지에서 물성값을 추출합니다."""
        try:
            await page.goto(material_url, timeout=60000)
            await page.wait_for_load_state('networkidle', timeout=60000)
            
            properties = []
            
            # 0. 재질 설명 텍스트 추출
            description = await self.extract_material_description(page)
            
            # 1. Mechanical Properties 추출
            mechanical_props = await self.extract_section_properties(page, "Mechanical", "mech")
            properties.extend(mechanical_props)
            
            # 2. Thermal Properties 추출
            thermal_props = await self.extract_section_properties(page, "Thermal", "therm")
            properties.extend(thermal_props)
            
            # 3. Electrical Properties 추출
            electrical_props = await self.extract_section_properties(page, "Electrical", "ele")
            properties.extend(electrical_props)
            
            # 4. Otherwise Unclassified Properties 추출
            other_props = await self.extract_section_properties(page, "Other", "other")
            properties.extend(other_props)
            
            # 5. Alloy Composition 추출
            composition_props = await self.extract_composition_properties(page)
            properties.extend(composition_props)
            
            material_data = {
                "name": material_name,
                "url": material_url,
                "category": "system.chemical",  # 기본값
                "description": description,  # 설명 텍스트 추가
                "properties": properties
            }
            
            logger.info(f"'{material_name}': {len(properties)}개 물성값 추출 완료")
            return material_data
            
        except PlaywrightTimeoutError:
            logger.error(f"재질 '{material_name}' 페이지 로딩 타임아웃 (60초 초과)")
            return None
        except Exception as e:
            logger.error(f"재질 '{material_name}' 물성값 추출 중 오류: {e}")
            return None
    
    async def extract_section_properties(self, page, section_name, class_name):
        """특정 섹션의 물성값을 추출합니다."""
        properties = []
        
        try:
            # 섹션 찾기
            section_selector = f'section:has(a[name="{section_name}"])'
            section = await page.query_selector(section_selector)
            
            if not section:
                logger.warning(f"{section_name} 섹션을 찾을 수 없습니다.")
                return properties
            
            # 물성값 div 찾기
            property_divs = await section.query_selector_all(f'div.{class_name}')
            
            for prop_div in property_divs:
                try:
                    # 물성명 추출
                    name_element = await prop_div.query_selector('p:first-child')
                    if not name_element:
                        continue
                    
                    property_name = await name_element.text_content()
                    property_name = property_name.strip()
                    
                    # 값과 단위 추출
                    value_element = await prop_div.query_selector('p:last-child')
                    if not value_element:
                        continue
                    
                    value_text = await value_element.text_content()
                    value_text = value_text.strip()
                    
                    # 값과 단위 분리
                    value_parts = self.parse_value_and_unit(value_text)
                    if value_parts:
                        properties.append({
                            "name": property_name,
                            "scalars": value_parts["value"],
                            "units": value_parts["unit"]
                        })
                
                except Exception as e:
                    logger.warning(f"물성값 추출 중 오류: {e}")
                    continue
        
        except Exception as e:
            logger.error(f"{section_name} 섹션 처리 중 오류: {e}")
        
        return properties
    
    async def extract_composition_properties(self, page):
        """Alloy Composition 섹션의 성분 정보를 추출합니다."""
        properties = []
        
        try:
            # Composition 섹션 찾기
            section_selector = 'section:has(a[name="Composition"])'
            section = await page.query_selector(section_selector)
            
            if not section:
                logger.warning("Composition 섹션을 찾을 수 없습니다.")
                return properties
            
            # table.comps에서 합금 성분 정보 추출
            comps_table = await section.query_selector('table.comps')
            if not comps_table:
                logger.warning("table.comps를 찾을 수 없습니다. 섹션 내 다른 테이블을 시도합니다.")
                comps_table = await section.query_selector('table') # Fallback to any table within the section

            if comps_table:
                logger.info("합금 성분 테이블 발견, 합금 성분 정보 추출 중...")
                
                # 테이블의 모든 행 추출
                rows = await comps_table.query_selector_all('tbody tr')
                composition_data = []
                
                for row in rows:
                    try:
                        # 첫 번째 td에서 원소명 추출
                        element_cell = await row.query_selector('td:first-child')
                        if element_cell:
                            # hide-narrow 클래스의 span에서 전체 이름 추출
                            full_name_span = await element_cell.query_selector('span.hide-narrow')
                            # inline-narrow 클래스의 span에서 기호 추출
                            symbol_span = await element_cell.query_selector('span.inline-narrow')
                            
                            element_name = ""
                            element_symbol = ""
                            
                            if full_name_span:
                                element_name = await full_name_span.text_content()
                                element_name = element_name.strip() if element_name else ""
                            
                            if symbol_span:
                                element_symbol = await symbol_span.text_content()
                                element_symbol = element_symbol.strip() if element_symbol else ""
                            
                            # 세 번째 td에서 퍼센트 범위 추출 (첫 번째: 원소명, 두 번째: 바, 세 번째: 퍼센트)
                            percent_cell = await row.query_selector('td:nth-child(3)')
                            if percent_cell:
                                percent_text = await percent_cell.text_content()
                                percent_text = percent_text.strip() if percent_text else ""
                                
                                if element_name and percent_text:
                                    composition_data.append({
                                        "element": element_name,
                                        "symbol": element_symbol,
                                        "percentage": percent_text
                                    })
                                    logger.debug(f"성분 추출: {element_name} ({element_symbol}): {percent_text}%")
                    
                    except Exception as row_error:
                        logger.warning(f"테이블 행 처리 중 오류: {row_error}")
                        continue
                
                # 추출된 성분 정보를 JSON 문자열로 변환하여 저장
                if composition_data:
                    properties.append({
                        "name": "Alloy Composition",
                        "scalars": json.dumps(composition_data, ensure_ascii=False),
                        "units": "% weight"
                    })
                    logger.info(f"합금 성분 {len(composition_data)}개 추출 완료")
                else:
                    logger.warning("테이블에서 성분 정보를 추출할 수 없습니다.")
            
            else:
                # 테이블이 없는 경우 기존 방식으로 텍스트 추출
                prose_div = await section.query_selector('div.prose')
                if prose_div:
                    composition_text = await prose_div.text_content()
                    if composition_text:
                        properties.append({
                            "name": "Alloy Composition",
                            "scalars": composition_text.strip(),
                            "units": "text"
                        })
                        logger.info("텍스트 형태의 합금 성분 정보 추출")
        
        except Exception as e:
            logger.error(f"Composition 섹션 처리 중 오류: {e}")
        
        return properties
    
    async def extract_material_description(self, page):
        """재질 페이지에서 설명 텍스트를 추출합니다. 마지막 그래프 비교 문단은 제외합니다."""
        try:
            # 페이지의 주요 콘텐츠 영역에서 설명 텍스트 찾기
            # 일반적으로 재질 설명은 페이지 상단의 prose 클래스 div에 있습니다
            description_selectors = [
                'div.prose p',  # 일반적인 설명 텍스트
                'article p',    # 기사 형태의 설명
                'main p',       # 메인 콘텐츠 영역의 문단
                '.content p'    # 콘텐츠 영역의 문단
            ]
            
            description_paragraphs = []
            
            for selector in description_selectors:
                paragraphs = await page.query_selector_all(selector)
                if paragraphs:
                    for p in paragraphs:
                        text = await p.text_content()
                        if text and text.strip():
                            # 그래프 비교 문단 제외 (특정 키워드로 식별)
                            if not self.is_graph_comparison_paragraph(text.strip()):
                                description_paragraphs.append(text.strip())
                    break  # 첫 번째로 찾은 selector에서 텍스트를 얻으면 중단
            
            # 설명 텍스트 결합
            if description_paragraphs:
                return ' '.join(description_paragraphs)
            else:
                logger.warning("재질 설명 텍스트를 찾을 수 없습니다.")
                return ""
                
        except Exception as e:
            logger.error(f"재질 설명 추출 중 오류: {e}")
            return ""
    
    def is_graph_comparison_paragraph(self, text):
        """그래프 비교 문단인지 확인합니다."""
        # 그래프 비교 문단을 식별하는 키워드들
        graph_keywords = [
            "그래프 막대",
            "막대가 가득 차면",
            "가장 높은 값을 의미",
            "절반만 차면",
            "비교합니다",
            "chart bars",
            "bars compare",
            "highest value",
            "half-full"
        ]
        
        text_lower = text.lower()
        for keyword in graph_keywords:
            if keyword.lower() in text_lower:
                return True
        return False
    
    def parse_value_and_unit(self, value_text):
        """값과 단위를 분리합니다. SI 단위만 추출하고 영국계 단위는 제거합니다."""
        try:
            # HTML 태그 제거
            import re
            clean_text = re.sub(r'<[^>]+>', '', value_text)
            
            # 일반적인 패턴으로 값과 단위 분리
            # 예: "68 GPa", "1.7 to 13 %", "100 to 1880 kJ/m³"
            pattern = r'^([\d\.\s\-to]+)\s*(.*)$'
            match = re.match(pattern, clean_text.strip())
            
            if match:
                value = match.group(1).strip()
                unit_text = match.group(2).strip()
                
                # SI 단위만 추출하고 영국계 단위 제거
                si_unit = self.extract_si_unit(unit_text)
                
                return {
                    "value": value,
                    "unit": si_unit
                }
        
        except Exception as e:
            logger.warning(f"값 파싱 중 오류: {e}")
        
        return None
    
    def extract_si_unit(self, unit_text):
        """단위 텍스트에서 SI 단위만 추출합니다."""
        import re
        
        # SI 단위 패턴 정의 (복합 단위를 먼저 매칭하도록 순서 조정)
        si_units = [
            # 복합 단위 (먼저 매칭)
            r'J/kg-K', r'kJ/kg-K', r'W/m-K', r'W/cm-K', r'µm/m-K',
            r'g/cm3', r'kg/m3', r'cm3/g', r'L/kg',
            r'kg CO2/kg material', r'% IACS', r'% relative',
            # 단순 단위
            r'GPa', r'MPa', r'kPa', r'Pa',
            r'°C', r'K',
            r'J/g', r'kJ/g', r'MJ/kg',
            r'%', r'mV', r'text'
        ]
        
        # 단위 텍스트에서 첫 번째로 매칭되는 SI 단위 찾기
        for si_unit in si_units:
            # 특수 문자를 이스케이프하여 정확한 매칭
            escaped_unit = re.escape(si_unit)
            pattern = r'\b' + escaped_unit + r'\b'
            match = re.search(pattern, unit_text)
            if match:
                return match.group(0)
        
        # 매칭되는 SI 단위가 없으면 첫 번째 단어만 반환 (기본 단위로 가정)
        first_word = unit_text.split()[0] if unit_text.split() else ""
        
        # 영국계 단위 패턴 제거 (psi, °F, BTU 등이 포함된 경우)
        imperial_patterns = [
            r'\d+\s*x\s*10\d*\s*psi',  # "22 to 34 x 103 psi"
            r'\d+\s*psi',              # "1000 psi"
            r'\d+\s*°F',               # "390 °F"
            r'\d+\s*BTU[^A-Za-z]*',    # "130 BTU/h-ft-°F"
            r'\d+\s*lb[^A-Za-z]*',     # "170 lb/ft3"
            r'\d+\s*gal[^A-Za-z]*'     # "140 gal/lb"
        ]
        
        # 영국계 단위가 포함된 경우 첫 번째 단어만 반환
        for pattern in imperial_patterns:
            if re.search(pattern, unit_text):
                return first_word
        
        return first_word
    
    async def process_middle_category_parallel(self, browser, major_name, middle_info, extract_properties, max_materials_per_category):
        """단일 중분류를 병렬로 처리합니다."""
        page = await browser.new_page()
        try:
            middle_name = middle_info['name']
            middle_url = middle_info['url']
            
            logger.info(f"\n--- {middle_name} 중분류 처리 시작 (병렬) ---")
            
            # 먼저 중분류에서 바로 재질이 있는지 확인 (3단계 구조)
            direct_materials = await self.check_if_materials_at_middle_level(page, middle_name, middle_url)
            
            if direct_materials:
                # 3단계 구조: 중분류에서 바로 재질이 나오는 경우
                logger.info(f"{middle_name}: 3단계 구조로 처리")
                
                if extract_properties:
                    # 물성값 추출을 위해 각 재질 페이지 방문 (제한된 수만)
                    materials_with_properties = []
                    
                    for i, material_info in enumerate(direct_materials[:max_materials_per_category]):
                        material_name = material_info['name']
                        material_url = material_info['url']
                        
                        logger.info(f"  재질 {i+1}/{min(len(direct_materials), max_materials_per_category)}: {material_name}")
                        
                        # 물성값 추출
                        properties = await self.extract_material_properties(page, material_url, material_name)
                        
                        if properties:
                            material_data = {
                                'name': material_name,
                                'url': material_url,
                                'category': f"{major_name} > {middle_name}",
                                'description': properties.get('description', ''),
                                'properties': properties.get('properties', {})
                            }
                            
                            materials_with_properties.append(material_data)
                            self.materials_data.append(material_data)
                            
                            # 요청 간격 조절
                            await asyncio.sleep(0.5)
                    
                    return {middle_name: {'materials': materials_with_properties}}
                else:
                    # 물성값 없이 재질명과 URL만 저장
                    return {middle_name: {'materials': direct_materials}}
            else:
                # 4단계 구조: 기존 방식으로 소분류 추출
                logger.info(f"{middle_name}: 4단계 구조로 처리")
                sub_categories = await self.crawl_middle_category(page, middle_name, middle_url)
                
                if sub_categories:
                    middle_result = {}
                    
                    for sub_info in sub_categories:
                        sub_name = sub_info['name']
                        sub_url = sub_info['url']
                        
                        # 3단계: 자재명과 URL 추출
                        materials_info = await self.crawl_sub_category_with_urls(page, sub_name, sub_url)
                    
                        if materials_info and extract_properties:
                            # 물성값 추출을 위해 각 재질 페이지 방문 (제한된 수만)
                            materials_with_properties = []
                            
                            for i, material_info in enumerate(materials_info[:max_materials_per_category]):
                                material_name = material_info['name']
                                material_url = material_info['url']
                                
                                logger.info(f"물성값 추출 중: {material_name} ({i+1}/{min(len(materials_info), max_materials_per_category)})")
                                
                                # 물성값 추출
                                material_data = await self.extract_material_properties(page, material_url, material_name)
                                
                                if material_data:
                                    material_data['category'] = f"{major_name} > {middle_name} > {sub_name}"
                                    materials_with_properties.append(material_data)
                                    self.materials_data.append(material_data)
                                    
                                    # 요청 간격 조절
                                    await asyncio.sleep(0.5)
                            
                            middle_result[sub_name] = materials_with_properties
                        elif materials_info:
                            # 물성값 없이 재질명과 URL만 저장
                            middle_result[sub_name] = materials_info
                    
                    return {middle_name: middle_result}
                else:
                    return {middle_name: {}}
        
        except Exception as e:
            logger.error(f"중분류 '{middle_name}' 병렬 처리 중 오류: {e}")
            return {middle_name: {}}
        finally:
            await page.close()

    async def crawl_full_structure_with_properties_parallel(self, extract_properties=True, max_materials_per_category=50, max_concurrent=5):
        """전체 4단계 카테고리 구조를 병렬로 크롤링하고 물성값을 추출합니다."""
        async with async_playwright() as p:
            # headless=True로 설정하여 성능 향상
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            try:
                # 1단계: 대분류 및 중분류 추출
                major_categories = await self.crawl_main_categories(page)
                await page.close()
                
                full_structure = {}
                
                for major_name, middle_list in major_categories.items():
                    logger.info(f"\n=== {major_name} 처리 시작 (병렬) ===")
                    full_structure[major_name] = {}
                    
                    # 중분류를 max_concurrent개씩 병렬 처리
                    for i in range(0, len(middle_list), max_concurrent):
                        batch = middle_list[i:i + max_concurrent]
                        logger.info(f"중분류 배치 {i//max_concurrent + 1} 처리 중: {[info['name'] for info in batch]}")
                        
                        # 병렬 작업 생성
                        tasks = [
                            self.process_middle_category_parallel(browser, major_name, middle_info, extract_properties, max_materials_per_category)
                            for middle_info in batch
                        ]
                        
                        # 병렬 실행
                        results = await asyncio.gather(*tasks, return_exceptions=True)
                        
                        # 결과 병합
                        for result in results:
                            if isinstance(result, dict):
                                full_structure[major_name].update(result)
                            elif isinstance(result, Exception):
                                logger.error(f"병렬 처리 중 예외 발생: {result}")
                
                return full_structure
                
            except Exception as e:
                logger.error(f"크롤링 중 오류 발생: {e}")
                return {}
            finally:
                await browser.close()

    async def crawl_full_structure_with_properties(self, extract_properties=True, max_materials_per_category=5):
        """전체 4단계 카테고리 구조를 크롤링하고 물성값을 추출합니다."""
        async with async_playwright() as p:
            # headless=False로 설정하여 브라우저 화면을 띄움
            browser = await p.chromium.launch(headless=False, slow_mo=1000)
            page = await browser.new_page()
            
            try:
                # 1단계: 대분류 및 중분류 추출
                major_categories = await self.crawl_main_categories(page)
                
                full_structure = {}
                
                for major_name, middle_list in major_categories.items():
                    logger.info(f"\n=== {major_name} 처리 시작 ===")
                    full_structure[major_name] = {}
                    
                    for middle_info in middle_list:
                        middle_name = middle_info['name']
                        middle_url = middle_info['url']
                        
                        logger.info(f"\n--- {middle_name} 중분류 처리 시작 ---")
                        
                        # 먼저 중분류에서 바로 재질이 있는지 확인 (3단계 구조)
                        direct_materials = await self.check_if_materials_at_middle_level(page, middle_name, middle_url)
                        
                        if direct_materials:
                            # 3단계 구조: 중분류에서 바로 재질이 나오는 경우
                            logger.info(f"{middle_name}: 3단계 구조로 처리")
                            full_structure[major_name][middle_name] = {}
                            
                            if extract_properties:
                                # 물성값 추출을 위해 각 재질 페이지 방문 (제한된 수만)
                                materials_with_properties = []
                                
                                for i, material_info in enumerate(direct_materials[:max_materials_per_category]):
                                    material_name = material_info['name']
                                    material_url = material_info['url']
                                    
                                    logger.info(f"  재질 {i+1}/{min(len(direct_materials), max_materials_per_category)}: {material_name}")
                                    
                                    # 물성값 추출
                                    properties = await self.extract_material_properties(page, material_url, material_name)
                                    
                                    material_data = {
                                        'name': material_name,
                                        'url': material_url,
                                        'category': f"{major_name} > {middle_name}",
                                        'description': properties.get('description', ''),
                                        'properties': properties.get('properties', {})
                                    }
                                    
                                    materials_with_properties.append(material_data)
                                    self.materials_data.append(material_data)
                                    
                                    # 요청 간격 조절
                                    await asyncio.sleep(1)
                                
                                # 직접 재질을 중분류 하위에 저장
                                full_structure[major_name][middle_name] = {
                                    'materials': materials_with_properties
                                }
                            else:
                                # 물성값 없이 재질명과 URL만 저장
                                full_structure[major_name][middle_name] = {
                                    'materials': direct_materials
                                }
                        else:
                            # 4단계 구조: 기존 방식으로 소분류 추출
                            logger.info(f"{middle_name}: 4단계 구조로 처리")
                            sub_categories = await self.crawl_middle_category(page, middle_name, middle_url)
                            
                            if sub_categories:
                                full_structure[major_name][middle_name] = {}
                                
                                for sub_info in sub_categories:
                                    sub_name = sub_info['name']
                                    sub_url = sub_info['url']
                                    
                                    # 3단계: 자재명과 URL 추출
                                    materials_info = await self.crawl_sub_category_with_urls(page, sub_name, sub_url)
                                
                                    if materials_info and extract_properties:
                                        # 물성값 추출을 위해 각 재질 페이지 방문 (제한된 수만)
                                        materials_with_properties = []
                                        
                                        for i, material_info in enumerate(materials_info[:max_materials_per_category]):
                                            material_name = material_info['name']
                                            material_url = material_info['url']
                                            
                                            logger.info(f"물성값 추출 중: {material_name} ({i+1}/{min(len(materials_info), max_materials_per_category)})")
                                            
                                            # 물성값 추출
                                            material_data = await self.extract_material_properties(page, material_url, material_name)
                                            
                                            if material_data:
                                                materials_with_properties.append(material_data)
                                                self.materials_data.append(material_data)
                                            
                                            # 요청 간격 조절
                                            await asyncio.sleep(2)
                                        
                                        full_structure[major_name][middle_name][sub_name] = materials_with_properties
                                    
                                    elif materials_info:
                                        # 물성값 추출 없이 재질명만 저장
                                        full_structure[major_name][middle_name][sub_name] = [m['name'] for m in materials_info]
                                    
                                    # 요청 간격 조절
                                    await asyncio.sleep(1)
                        
                        # 중분류 완료 후 즉시 저장
                        logger.info(f"--- {middle_name} 중분류 완료, 파일 저장 중 ---")
                        save_categories_to_json(full_structure, "makeitfrom_categories_with_properties.json")
                        
                        if self.materials_data:
                            save_materials_to_json(self.materials_data, "makeitfrom_materials_properties.json")
                            logger.info(f"현재까지 {len(self.materials_data)}개 재질의 물성값이 저장되었습니다.")
                        
                        # 요청 간격 조절
                        await asyncio.sleep(1)
                
                return full_structure
                
            except Exception as e:
                logger.error(f"크롤링 중 오류 발생: {e}")
                return {}
            
            finally:
                await browser.close()
    
    async def crawl_sub_category_with_urls(self, page, category_name, category_url):
        """소분류에서 자재명과 URL을 추출합니다."""
        try:
            await page.goto(category_url)
            await page.wait_for_load_state('networkidle')
            
            # 자재명 링크 찾기
            materials_info = []
            links = await page.query_selector_all('a[href*="/material-properties/"]')
            
            for link in links:
                href = await link.get_attribute('href')
                link_text = await link.text_content()
                if href and link_text:
                    full_url = urljoin(self.base_url, href)
                    materials_info.append({
                        'name': link_text.strip(),
                        'url': full_url
                    })
            
            logger.info(f"'{category_name}': {len(materials_info)}개 자재 발견")
            return materials_info
            
        except Exception as e:
            logger.error(f"소분류 '{category_name}' 크롤링 중 오류: {e}")
            return []

def save_categories_to_json(categories, filename):
    """카테고리 데이터를 JSON 파일로 저장"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(categories, f, ensure_ascii=False, indent=2)
    logger.info(f"카테고리 데이터가 {filename}에 저장되었습니다.")

def save_materials_to_json(materials_data, filename):
    """물성값 데이터를 MakeItFrom.json 형식으로 저장"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(materials_data, f, ensure_ascii=False, indent=4)
    logger.info(f"물성값 데이터가 {filename}에 저장되었습니다.")

async def main():
    """메인 실행 함수"""
    logger.info("MakeItFrom 공개 페이지 카테고리 및 물성값 크롤링을 시작합니다... (병렬 처리)")
    
    crawler = PublicCategoryCrawler()
    
    # 물성값 추출 여부와 카테고리당 최대 재질 수 설정
    extract_properties = True
    max_materials_per_category = 50  # 모든 재료를 수집하기 위해 충분히 큰 값으로 설정
    max_concurrent = 5  # 동시에 처리할 중분류 수
    
    categories = await crawler.crawl_full_structure_with_properties_parallel(
        extract_properties=extract_properties,
        max_materials_per_category=max_materials_per_category,
        max_concurrent=max_concurrent
    )
    
    if categories:
        # 카테고리 구조 저장
        save_categories_to_json(categories, "makeitfrom_categories_with_properties.json")
        
        # 물성값 데이터만 별도로 저장 (MakeItFrom.json 형식)
        if crawler.materials_data:
            save_materials_to_json(crawler.materials_data, "makeitfrom_materials_properties.json")
            logger.info(f"총 {len(crawler.materials_data)}개 재질의 물성값이 추출되었습니다.")
        
        logger.info("크롤링이 완료되었습니다.")
        
        # 통계 출력
        logger.info(f"총 대분류: {len(categories)}")
        total_materials = 0
        total_properties = 0
        
        for major, middle_dict in categories.items():
            logger.info(f"{major}: {len(middle_dict)} 개 중분류")
            for middle, sub_dict in middle_dict.items():
                if isinstance(sub_dict, dict):
                    logger.info(f"  - {middle}: {len(sub_dict)} 개 소분류")
                    for sub, materials in sub_dict.items():
                        if isinstance(materials, list) and materials:
                            material_count = len(materials)
                            total_materials += material_count
                            
                            # 물성값이 있는 경우 카운트
                            if isinstance(materials[0], dict) and 'properties' in materials[0]:
                                for material in materials:
                                    total_properties += len(material.get('properties', []))
                                logger.info(f"    - {sub}: {material_count} 개 자재 (물성값 포함)")
                            else:
                                logger.info(f"    - {sub}: {material_count} 개 자재")
        
        logger.info(f"총 자재 수: {total_materials}")
        logger.info(f"총 물성값 수: {total_properties}")
    else:
        logger.error("크롤링에 실패했습니다.")

if __name__ == "__main__":
    asyncio.run(main())