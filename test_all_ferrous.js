// 철금속 카테고리의 모든 자재에 대해 최신 2개월 데이터를 조회하여 변동률을 계산합니다.
async function testAllFerrousMaterials() {
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

  console.log(`철금속 자재(${materials.length}종) API 요청 중...`);
  try {
    const response = await fetch('http://localhost:3000/api/materials/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materials, startDate, endDate, interval }),
    });

    if (!response.ok) {
      console.error('API Error:', response.status);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }

    const data = await response.json();
    console.log(`데이터 수신 완료. 총 레코드 수: ${data.length}`);

    materials.forEach(materialId => {
      const materialData = data.filter(item => item.specification === materialId);
      const sortedData = materialData.sort((a, b) => new Date(b.time_bucket || b.date).getTime() - new Date(a.time_bucket || a.date).getTime());
      
      console.log(`\n[${materialId}]`);
      if (sortedData.length >= 2) {
        const current = sortedData[0];
        const previous = sortedData[1];
        
        // API 응답 구조에 따라 가격 필드 확인 (price 또는 average_price 등)
        const currentPrice = current.average_price || current.price || current.avg_price;
        const previousPrice = previous.average_price || previous.price || previous.avg_price;
        
        if (currentPrice !== undefined && previousPrice !== undefined) {
          const change = ((currentPrice - previousPrice) / previousPrice) * 100;
          console.log(`  - 최신: ${current.time_bucket || current.date} (${currentPrice})`);
          console.log(`  - 이전: ${previous.time_bucket || previous.date} (${previousPrice})`);
          console.log(`  - 변동률: ${change.toFixed(2)}%`);
          if (Math.abs(change) < 1) {
            console.log('  - 결과: 변동없음 (1% 미만)');
          } else {
            console.log(`  - 결과: ${change > 0 ? '상승' : '하락'}`);
          }
        } else {
          console.log('  - 가격 데이터 누락 (필드: ', Object.keys(current), ')');
        }
      } else {
        console.log(`  - 데이터 부족 (레코드 수: ${sortedData.length})`);
      }
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

testAllFerrousMaterials();
