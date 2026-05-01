async function checkAllFerrousRegions() {
  const materials = [
    '스테인리스열연강판 STS304 -  (HR) 3~6',
    '스테인리스열연강판 STS316L -  (HR) 3~6',
    '열연강판 -  3.0 ≤T＜ 4.5, 1,219 ×2,438㎜',
    '고장력철근(하이바)(SD 400) -  D32㎜, 6.230',
    'H형강 -  (소형)H200×B100×t₁5.5×t₂8㎜ 단중21.3㎏/m',
    '고철(철) - 중량철 B'
  ];
  const startDate = '2025-01-01';
  const endDate = '2026-03-11';
  const interval = 'monthly';

  console.log('철금속 모든 자재 지역 중복 확인 중...');
  try {
    const response = await fetch('http://localhost:3000/api/materials/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materials, startDate, endDate, interval }),
    });

    const data = await response.json();
    materials.forEach(material => {
      const materialData = data.filter(item => item.specification === material);
      const countsByMonth = {};
      materialData.forEach(item => {
        const month = item.time_bucket;
        countsByMonth[month] = (countsByMonth[month] || 0) + 1;
      });

      const duplicateMonths = Object.keys(countsByMonth).filter(m => countsByMonth[m] > 1);
      if (duplicateMonths.length > 0) {
        console.log(`⚠️ [${material}] 중복 발견!`);
        duplicateMonths.forEach(m => {
          const items = materialData.filter(item => item.time_bucket === m);
          console.log(`  - ${m}: ${items.length}개 지역 (${items.map(i => i.region).join(', ')})`);
        });
      } else {
        console.log(`✅ [${material}] 월별 1개 데이터만 있음.`);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAllFerrousRegions();
