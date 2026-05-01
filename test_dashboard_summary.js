// ES 모듈 형식을 사용하며, Node.js 18+의 내장 fetch를 활용합니다.
async function testApi() {
  const materials = [
    '스테인리스열연강판 STS304 -  (HR) 3~6',
    '열연강판 -  3.0 ≤T＜ 4.5, 1,219 ×2,438㎜',
    '고장력철근(하이바)(SD 400) -  D32㎜, 6.230',
    'H형강 -  (소형)H200×B100×t₁5.5×t₂8㎜ 단중21.3㎏/m'
  ];
  
  const startDate = '2025-01-01';
  const endDate = '2026-03-11';
  const interval = 'monthly';

  console.log('API 요청 중...');
  try {
    const response = await fetch('http://localhost:3000/api/materials/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materials, startDate, endDate, interval }),
    });

    if (!response.ok) {
      console.error('API Error:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }

    const data = await response.json();
    console.log('데이터 수신 완료. 총 아이템 수:', data.length);
    
    if (data.length > 0) {
      console.log('샘플 데이터:', JSON.stringify(data[0], null, 2));
      
      // 자재별로 그룹화하여 최근 2개월 데이터 비교
      const grouped = {};
      data.forEach(item => {
        if (!grouped[item.specification]) {
          grouped[item.specification] = [];
        }
        grouped[item.specification].push(item);
      });

      for (const spec in grouped) {
        const items = grouped[spec].sort((a, b) => new Date(b.time_bucket || b.date).getTime() - new Date(a.time_bucket || a.date).getTime());
        console.log(`\n--- [${spec}] ---`);
        if (items.length >= 2) {
          const latest = items[0];
          const previous = items[1];
          
          // API 응답 구조에 따라 가격 필드 확인 (price 또는 average_price 등)
          const latestPrice = latest.price || latest.average_price || latest.avg_price;
          const previousPrice = previous.price || previous.average_price || previous.avg_price;
          
          if (latestPrice !== undefined && previousPrice !== undefined) {
            const change = ((latestPrice - previousPrice) / previousPrice) * 100;
            console.log(`최근 날짜: ${latest.time_bucket || latest.date}, 가격: ${latestPrice} (${latest.unit})`);
            console.log(`이전 날짜: ${previous.time_bucket || previous.date}, 가격: ${previousPrice} (${previous.unit})`);
            console.log(`변동률: ${change.toFixed(2)}%`);
            
            if (Math.abs(change) < 1) {
              console.log('결과: 변동없음 (절대값 1% 미만)');
            } else {
              console.log('결과: 변동 있음');
            }
          } else {
            console.log('가격을 찾을 수 없습니다. 필드 목록:', Object.keys(latest));
          }
        } else {
          console.log('비교할 데이터가 부족합니다.');
        }
      }
    }
  } catch (error) {
    console.error('Fetch Error:', error);
  }
}

testApi();
