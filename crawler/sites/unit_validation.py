"""
단위 검증 모듈
자재 가격 데이터의 단위를 검증하고 표준화하는 기능을 제공합니다.
"""

import re
from typing import Dict, Any, Optional, List


def log(message: str, level: str = "INFO"):
    """로깅 함수"""
    import datetime
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")


class UnitValidator:
    """단위 검증 및 표준화 클래스"""
    
    def __init__(self):
        """단위 검증기 초기화"""
        # 표준 단위 매핑
        self.standard_units = {
            'kg': '원/kg',
            '㎏': '원/kg', 
            'ton': '원/톤',
            '톤': '원/톤',
            'MT': '원/톤',
            'M/T': '원/톤',
            '개': '원/개',
            '매': '원/매',
            'm³': '원/m³',
            '㎡': '원/㎡',
            'm²': '원/㎡',
            'L': '원/L',
            '리터': '원/L'
        }
        
        # 카테고리별 예상 단위
        self.category_units = {
            '시멘트': ['원/톤', '원/포'],
            '골재': ['원/m³', '원/톤'],
            '아스콘': ['원/톤'],
            '레미콘': ['원/m³'],
            '철근': ['원/톤', '원/kg'],
            '형강': ['원/톤', '원/kg'],
            '목재': ['원/m³', '원/매'],
            '벽돌': ['원/개', '원/매'],
            '타일': ['원/㎡', '원/매'],
            '페인트': ['원/L', '원/kg']
        }
    
    def validate_unit(self, major_category: str, middle_category: str, 
                     sub_category: str, specification: str, unit: str) -> Dict[str, Any]:
        """
        단위 검증
        
        Args:
            major_category: 대분류
            middle_category: 중분류  
            sub_category: 소분류
            specification: 규격
            unit: 단위
            
        Returns:
            검증 결과 딕셔너리
        """
        result = {
            'is_valid': False,
            'actual_unit': unit,
            'recommended_unit': None,
            'recommended_action': 'reject',  # 'accept', 'auto_correct', 'reject'
            'issues': []
        }
        
        if not unit or unit.strip() == '':
            result['issues'].append('단위가 비어있음')
            return result
        
        unit = unit.strip()
        
        # 표준 단위 형식 확인 (원/단위)
        if unit.startswith('원/'):
            result['is_valid'] = True
            result['recommended_action'] = 'accept'
            return result
        
        # 표준 단위로 변환 가능한지 확인
        if unit in self.standard_units:
            result['recommended_unit'] = self.standard_units[unit]
            result['recommended_action'] = 'auto_correct'
            return result
        
        # 카테고리별 예상 단위와 비교
        expected_units = self._get_expected_units(major_category, middle_category, sub_category)
        if expected_units:
            result['recommended_unit'] = expected_units[0]  # 첫 번째 추천 단위
            result['issues'].append(f'예상 단위: {", ".join(expected_units)}')
        
        result['issues'].append(f'알 수 없는 단위: {unit}')
        return result
    
    def auto_correct_unit(self, major_category: str, middle_category: str,
                         sub_category: str, specification: str, unit: str) -> Optional[str]:
        """
        단위 자동 수정
        
        Returns:
            수정된 단위 또는 None
        """
        if not unit:
            return None
            
        unit = unit.strip()
        
        # 표준 단위 매핑에서 찾기
        if unit in self.standard_units:
            return self.standard_units[unit]
        
        # 정규식을 사용한 패턴 매칭
        unit_patterns = {
            r'kg|㎏|키로': '원/kg',
            r'ton|톤|MT|M/T': '원/톤', 
            r'개|EA|ea': '원/개',
            r'매|장': '원/매',
            r'm³|㎥|입방미터': '원/m³',
            r'㎡|m²|제곱미터': '원/㎡',
            r'L|리터|ℓ': '원/L'
        }
        
        for pattern, standard_unit in unit_patterns.items():
            if re.search(pattern, unit, re.IGNORECASE):
                return standard_unit
        
        return None
    
    def _get_expected_units(self, major_category: str, middle_category: str, 
                          sub_category: str) -> List[str]:
        """카테고리에 따른 예상 단위 반환"""
        # 소분류에서 키워드 찾기
        for keyword, units in self.category_units.items():
            if keyword in sub_category or keyword in middle_category:
                return units
        
        # 기본 단위들
        return ['원/톤', '원/kg', '원/개', '원/m³']
    
    def get_unit_statistics(self, units: List[str]) -> Dict[str, Any]:
        """단위 통계 정보 반환"""
        stats = {
            'total_count': len(units),
            'valid_count': 0,
            'invalid_count': 0,
            'correctable_count': 0,
            'unit_distribution': {}
        }
        
        for unit in units:
            if not unit:
                continue
                
            # 단위별 분포
            if unit in stats['unit_distribution']:
                stats['unit_distribution'][unit] += 1
            else:
                stats['unit_distribution'][unit] = 1
            
            # 유효성 검사
            if unit.startswith('원/'):
                stats['valid_count'] += 1
            elif unit in self.standard_units:
                stats['correctable_count'] += 1
            else:
                stats['invalid_count'] += 1
        
        return stats