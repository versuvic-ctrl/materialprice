import json
import re
def convert_to_jsonc_fixed(obj, indent=0):
    """JSON 객체를 JSONC 형태로 변환 (trailing comma 문제 수정)"""
    result = []
    spaces = '  ' * indent
    if isinstance(obj, dict):
        result.append('{')
        items = list(obj.items())
        # 실제로 포함될 항목들만 필터링
        included_items = []
        excluded_items = []
        for key, value in items:
            if isinstance(value, dict) and 'unit' in value and 'status' in value:
                if value['status'] == 'include':
                    included_items.append((key, value))
                else:
                    excluded_items.append((key, value))
            else:
                included_items.append((key, value))
        # include 항목들 처리
        for i, (key, value) in enumerate(included_items):
            if isinstance(value, dict) and 'unit' in value and 'status' in value:
                # 단위 정보가 있는 항목 처리
                unit = value['unit']
                line = f'{spaces}  "{key}": {{"unit": "{unit}"}}'
                # 마지막 include 항목이고 exclude 항목이 없으면 콤마 제거
                if i == len(included_items) - 1 and not excluded_items:
                    pass  # 콤마 없음
                else:
                    line += ','
                result.append(line)
            else:
                # 중첩된 객체 처리
                result.append(f'{spaces}  "{key}": {{')
                nested_content = convert_to_jsonc_fixed(value, indent + 2)
                result.extend(nested_content[1:-1])  # { } 제거
                # 마지막 include 항목이고 exclude 항목이 없으면 콤마 제거
                if i == len(included_items) - 1 and not excluded_items:
                    result.append(f'{spaces}  }}')
                else:
                    result.append(f'{spaces}  }},')
        # exclude 항목들을 주석으로 처리
        for i, (key, value) in enumerate(excluded_items):
            unit = value['unit']
            line = f'{spaces}  // "{key}": {{"unit": "{unit}"}}'
            # 마지막 exclude 항목이면 콤마 제거
            if i < len(excluded_items) - 1:
                line += ','
            result.append(line)
        result.append(f'{spaces}}}')
    return result
def main():
    # 원본 파일 읽기
    with open('kpi_inclusion_list_compact.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    # JSONC 형태로 변환 (수정된 버전)
    jsonc_lines = convert_to_jsonc_fixed(data)
    # 파일 저장
    with open('kpi_inclusion_list_compact.jsonc', 'w', encoding='utf-8') as f:
        f.write('\n'.join(jsonc_lines))
    print('JSONC 파일 수정 완료!')
    print('trailing comma 문제가 해결되었습니다.')
if __name__ == "__main__":
    main()
