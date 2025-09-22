import re

class UnitValidator:
    def __init__(self):
        self.unit_patterns = {
            "전압": r"V",
            "전류": r"A",
            "전력": r"W",
            "저항": r"Ω",
            "정전용량": r"F",
            "인덕턴스": r"H",
            "주파수": r"Hz",
            "온도": r"°C|K",
            "길이": r"m|cm|mm|μm|nm",
            "질량": r"kg|g|mg|μg",
            "시간": r"s|ms|μs|ns",
            "면적": r"m²|cm²|mm²",
            "부피": r"m³|cm³|mm³|L|mL",
            "속도": r"m/s|km/h",
            "가속도": r"m/s²",
            "힘": r"N",
            "압력": r"Pa|kPa|MPa|bar|psi",
            "에너지": r"J|kJ|MJ|Wh|kWh",
            "밀도": r"kg/m³|g/cm³",
            "농도": r"mol/L|M|ppm|ppb",
            "각도": r"°|rad",
            "데이터_용량": r"B|KB|MB|GB|TB",
            "데이터_전송_속도": r"bps|Kbps|Mbps|Gbps",
            "밝기": r"cd|lm|lx",
            "색온도": r"K",
            "수명": r"시간|hr",
            "무게": r"g|kg",
            "크기": r"mm|cm",
            "두께": r"mm|cm",
            "직경": r"mm|cm",
            "폭": r"mm|cm",
            "높이": r"mm|cm",
            "수량": r"개|ea",
            "비율": r"%",
            "수치": r"", # 단위가 없는 순수 수치
            "기타": r".*" # 위에 해당하지 않는 모든 단위
        }

    def get_unit(self, spec_name: str) -> str:
        for unit_type, pattern in self.unit_patterns.items():
            if re.search(pattern, spec_name, re.IGNORECASE):
                return unit_type
        return "수치" # 기본값으로 수치 반환 (단위가 없는 경우)

    def extract_value_and_unit(self, spec_value: str) -> tuple[str, str]:
        # 숫자와 단위를 분리하는 정규식 (예: "100V", "50Hz", "2.5mm")
        match = re.match(r"([0-9\.]+)\s*([a-zA-Z°Ωµ²³/%]+)", spec_value)
        if match:
            value = match.group(1)
            unit = match.group(2)
            return value, unit
        return spec_value, ""

    def validate_and_apply_unit(self, spec_name: str, spec_value: str) -> tuple[str, str]:
        # spec_name에서 단위 유형을 먼저 파악
        unit_type_from_name = self.get_unit(spec_name)

        # spec_value에서 값과 단위를 추출
        extracted_value, extracted_unit = self.extract_value_and_unit(spec_value)

        # 추출된 단위가 spec_name에서 파악된 단위 유형과 일치하는지 확인
        if extracted_unit and re.search(self.unit_patterns.get(unit_type_from_name, r".*"), extracted_unit, re.IGNORECASE):
            return extracted_value, extracted_unit
        elif unit_type_from_name == "수치": # spec_name에 단위가 없는 경우
            return spec_value, ""
        else: # spec_name에 단위가 있지만 spec_value에서 추출되지 않거나 일치하지 않는 경우
            # spec_name에서 파악된 단위 유형을 반환
            return spec_value, unit_type_from_name