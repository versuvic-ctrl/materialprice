import json
import re
def convert_to_jsonc(obj, indent=0):
    """JSON 객체를 JSONC 형태로 변환"""
    result = []
    spaces = '  ' * indent
    if isinstance(obj, dict):
        result.append('{')
        items = list(obj.items())
        for i, (key, value) in enumerate(items):
            if isinstance(value, dict) and 'unit' in value and 'status' in value:
                # 단위 정보가 있는 항목 처리
                unit = value['unit']
                status = value['status']
                if status == 'exclude':
                    # exclude 항목은 주석 처리
                    line = f'{spaces}  // "{key}": {{"unit": "{unit}"}}'
                else:
                    # include 항목은 그대로
                    line = f'{spaces}  "{key}": {{"unit": "{unit}"}}'
                if i < len(items) - 1:
                    line += ','
                result.append(line)
            else:
                # 중첩된 객체 처리
                result.append(f'{spaces}  "{key}": {{')
                nested_content = convert_to_jsonc(value, indent + 2)
                result.extend(nested_content[1:-1])  # { } 제거
                if i < len(items) - 1:
                    result.append(f'{spaces}  }},')
                else:
                    result.append(f'{spaces}  }}')
        result.append(f'{spaces}}}')
    return result
def main():
    # 원본 파일 읽기
    with open('kpi_inclusion_list_compact.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    # JSONC 형태로 변환
    jsonc_lines = convert_to_jsonc(data)
    # 파일 저장
    with open('kpi_inclusion_list_compact.jsonc', 'w', encoding='utf-8') as f:
        f.write('\n'.join(jsonc_lines))
    print('JSONC 파일 생성 완료!')
    print('exclude 항목들이 주석 처리되었습니다.')
if __name__ == "__main__":
    main()
