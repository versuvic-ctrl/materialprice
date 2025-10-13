import MaterialComparisonPage from '@/components/comparison/MaterialComparisonPage';
import * as fs from 'fs';
import * as path from 'path';
import Layout from '@/components/layout/Layout';

export default async function ComparisonPage() {
  const filePath = path.join(process.cwd(), 'src', 'data', 'makeitfrom_categories_with_properties.json');
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const allData = JSON.parse(fileContents);

  return (
    <Layout title="재질 물성 및 부식성 상세">
      <MaterialComparisonPage initialData={allData} />
    </Layout>
  );
}