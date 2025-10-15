import * as fs from 'fs';
import * as path from 'path';
import dynamic from 'next/dynamic';

// 무거운 비교 컴포넌트를 동적 import로 최적화
const MaterialComparisonPage = dynamic(() => import('@/components/comparison/MaterialComparisonPage'), {
  loading: () => (
    <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
      <div className="text-gray-500">재질 비교 데이터 로딩 중...</div>
    </div>
  )
});

export default async function ComparisonPage() {
  const filePath = path.join(process.cwd(), 'src', 'data', 'makeitfrom_categories_with_properties.json');
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const allData = JSON.parse(fileContents);

  return (
    <>
      <MaterialComparisonPage initialData={allData} />
    </>
  );
}