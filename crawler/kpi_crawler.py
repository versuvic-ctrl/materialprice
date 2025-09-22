import os
import json
import asyncio
import logging
from datetime import datetime, timedelta
from supabase import create_client, Client
from unit_validation import UnitValidator

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)

# Supabase client initialization
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

INCLUSION_LIST_PATH = os.path.join(os.path.dirname(__file__), "kpi_inclusion_list.json")

class KpiCrawler:
    def __init__(self):
        self.unit_validator = UnitValidator()
        self.categories_to_crawl = self.load_categories_to_crawl()

    def load_categories_to_crawl(self):
        if not os.path.exists(INCLUSION_LIST_PATH):
            log.warning(f"KPI inclusion list not found at {INCLUSION_LIST_PATH}. "
                        "Crawler will not run without a valid inclusion list.")
            return {}

        with open(INCLUSION_LIST_PATH, 'r', encoding='utf-8') as f:
            inclusion_list = json.load(f)

        # Filter out commented categories (assuming comments start with # or //)
        filtered_categories = {}
        for major_cat, middle_cats in inclusion_list.items():
            if major_cat.startswith('#') or major_cat.startswith('//'):
                continue
            filtered_middle_cats = {}
            for middle_cat, sub_cats in middle_cats.items():
                if middle_cat.startswith('#') or middle_cat.startswith('//'):
                    continue
                filtered_sub_cats = {}
                for sub_cat, specs in sub_cats.items():
                    if sub_cat.startswith('#') or sub_cat.startswith('//'):
                        continue
                    filtered_specs = {
                        spec: unit for spec, unit in specs.items()
                        if not (spec.startswith('#') or spec.startswith('//'))
                    }
                    if filtered_specs:
                        filtered_sub_cats[sub_cat] = filtered_specs
                if filtered_sub_cats:
                    filtered_middle_cats[middle_cat] = filtered_sub_cats
            if filtered_middle_cats:
                filtered_categories[major_cat] = filtered_middle_cats
        return filtered_categories

    async def crawl_and_save(self):
        log.info("Starting KPI crawling process...")
        # This is where the actual crawling logic will go.
        # For now, we'll just log the categories to crawl.
        log.info(f"Categories to crawl: {json.dumps(self.categories_to_crawl, indent=2)}")
        log.info("KPI crawling process finished.")

async def check_running_crawler():
    # This function would check if another crawler instance is running
    # For now, it's a placeholder.
    return False

async def main():
    if await check_running_crawler():
        log.info("Another crawler instance is already running. Exiting.")
        return

    crawler = KpiCrawler()
    await crawler.crawl_and_save()

if __name__ == "__main__":
    asyncio.run(main())