1. 특정 대분류만 크롤링 (major_only)
python kpi_crawler.py --major "전기자재" --mode major_only

2. 특정 중분류만 크롤링 (middle_only)
python kpi_crawler.py --major "전기자재" --middle "전력케이블" --mode middle_only

3. 특정 소분류만 크롤링 (sub_only)
python kpi_crawler.py --major "전기자재" --middle "전력케이블" --sub "절연난연PVC시스케이블(FW-CV, TFR-CV)" --mode sub_only

4. 전체 크롤링 (기본값)
python kpi_crawler.py

5. 시작 날짜 지정
python kpi_crawler.py --major "전기자재" --mode major_only --start-year 2023 --start-month 01