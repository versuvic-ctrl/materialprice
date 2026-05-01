// DashboardClient.tsx와 동일한 방식으로 API를 호출하여 응답 필드를 확인합니다.
async function checkApiFields() {
  const materials = ['스테인리스열연강판 STS304 -  (HR) 3~6'];
  const startDate = '2025-01-01';
  const endDate = '2026-03-11';
  const interval = 'monthly';

  console.log('API 호출 중...');
  try {
    const response = await fetch('http://localhost:3000/api/materials/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materials, startDate, endDate, interval }),
    });

    const data = await response.json();
    if (data && data.length > 0) {
      console.log('응답 필드:', Object.keys(data[0]));
      console.log('첫 번째 레코드:', JSON.stringify(data[0], null, 2));
    } else {
      console.log('데이터가 없습니다.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkApiFields();
