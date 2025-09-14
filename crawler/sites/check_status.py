import json

with open('crawling_result.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f'Raw data items: {len(data["raw_crawled_data"])}')
print(f'Processed data items: {len(data["pandas_processed_data"])}')

# 최근 몇 개 항목 확인
if data["raw_crawled_data"]:
    print(f'Latest raw data: {data["raw_crawled_data"][-1]["major_category_name"]} - {data["raw_crawled_data"][-1]["middle_category_name"]} - {data["raw_crawled_data"][-1]["sub_category_name"]}')