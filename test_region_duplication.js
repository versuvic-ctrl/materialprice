async function checkRegionsInApi() {
  const materials = ['스테인리스열연강판 STS304 -  (HR) 3~6'];
  const startDate = '2025-01-01';
  const endDate = '2026-03-11';
  const interval = 'monthly';

  console.log('API 호출 중 (지역 중복 확인)...');
  try {
    const response = await fetch('http://localhost:3000/api/materials/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materials, startDate, endDate, interval }),
    });

    const data = await response.json();
    if (data && data.length > 0) {
      console.log(`수신된 데이터 개수: ${data.length}`);
      
      const countsByMonth = {};
      data.forEach(item => {
        const month = item.time_bucket;
        countsByMonth[month] = (countsByMonth[month] || 0) + 1;
      });

      console.log('월별 데이터 개수:');
      for (const month in countsByMonth) {
        console.log(`- ${month}: ${countsByMonth[month]}개`);
      }

      const duplicateMonths = Object.keys(countsByMonth).filter(m => countsByMonth[m] > 1);
      if (duplicateMonths.length > 0) {
        console.log('⚠️ 중복 데이터가 발견되었습니다! 월별 1개 이상의 데이터가 있습니다.');
        const sampleMonth = duplicateMonths[0];
        const sampleItems = data.filter(item => item.time_bucket === sampleMonth);
        console.log(`예시 월 (${sampleMonth}) 데이터:`, JSON.stringify(sampleItems, null, 2));
      } else {
        console.log('✅ 월별 데이터가 1개씩만 있습니다.');
      }
    } else {
      console.log('데이터가 없습니다.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkRegionsInApi();
