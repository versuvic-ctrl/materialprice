import json
import re
def main():
    # 원본 파일 읽기
    with open('kpi_inclusion_list_compact.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    # 먼저 include 항목만 필터링한 데이터 생성
    filtered_data = {}
    for major_key, major_value in data.items():
        filtered_major = {}
        for middle_key, middle_value in major_value.items():
            filtered_middle = {}
            for item_key, item_value in middle_value.items():
                if item_value.get('status') == 'include':
                    filtered_middle[item_key] = {"unit": item_value['unit']}
            if filtered_middle:  # 빈 카테고리는 제외
                filtered_major[middle_key] = filtered_middle
        if filtered_major:  # 빈 대분류는 제외
            filtered_data[major_key] = filtered_major
    # JSON으로 변환
    json_str = json.dumps(filtered_data, ensure_ascii=False, indent=2)
    # exclude 항목들을 주석으로 추가
    lines = json_str.split('\n')
    result_lines = []
    for major_key, major_value in data.items():
        if major_key not in filtered_data:
            continue
        for middle_key, middle_value in major_value.items():
            if middle_key not in filtered_data[major_key]:
                continue
            # 해당 중분류 섹션을 찾아서 exclude 항목들을 주석으로 추가
            exclude_items = []
            for item_key, item_value in middle_value.items():
                if item_value.get('status') == 'exclude':
                    exclude_items.append(f'    // "{item_key}": {{"unit": "{item_value["unit"]}"}}')
    # 더 간단한 방법: 직접 JSONC 문자열 생성
    jsonc_content = []
    jsonc_content.append('{')
    major_items = list(filtered_data.items())
    for major_idx, (major_key, major_value) in enumerate(major_items):
        jsonc_content.append(f'  "{major_key}": {{')
        middle_items = list(major_value.items())
        for middle_idx, (middle_key, middle_value) in enumerate(middle_items):
            jsonc_content.append(f'    "{middle_key}": {{')
            # include 항목들
            item_items = list(middle_value.items())
            for item_idx, (item_key, item_value) in enumerate(item_items):
                comma = ',' if item_idx < len(item_items) - 1 else ''
                jsonc_content.append(f'      "{item_key}": {{"unit": "{item_value["unit"]}"}}{comma}')
            # exclude 항목들을 주석으로 추가
            original_middle = data[major_key][middle_key]
            for item_key, item_value in original_middle.items():
                if item_value.get('status') == 'exclude':
                    jsonc_content.append(f'      // "{item_key}": {{"unit": "{item_value["unit"]}"}}')
            comma = ',' if middle_idx < len(middle_items) - 1 else ''
            jsonc_content.append(f'    }}{comma}')
        comma = ',' if major_idx < len(major_items) - 1 else ''
        jsonc_content.append(f'  }}{comma}')
    jsonc_content.append('}')
    # 파일 저장
    with open('kpi_inclusion_list_compact.jsonc', 'w', encoding='utf-8') as f:
        f.write('\n'.join(jsonc_content))
    print('깔끔한 JSONC 파일 생성 완료!')
if __name__ == "__main__":
    main()
