// 4각강(SS275) API 테스트 스크립트
const testSS275API = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/materials/prices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        materials: ['4각강(SS275) -  대변거리 16㎜'],
        startDate: '2023-10-01',
        endDate: '2025-10-15',
        interval: 'monthly'
      })
    });

    const data = await response.json();
    console.log('API 응답 구조:', Object.keys(data));
    console.log('API 응답:', JSON.stringify(data, null, 2));
    
    if (data.data && data.data.length > 0) {
      console.log('✅ 데이터 있음 (data 속성):', data.data.length, '개 항목');
      console.log('첫 번째 항목:', data.data[0]);
    } else if (Array.isArray(data) && data.length > 0) {
      console.log('✅ 데이터 있음 (배열):', data.length, '개 항목');
      console.log('첫 번째 항목:', data[0]);
    } else {
      console.log('❌ 데이터 없음');
      console.log('응답 타입:', typeof data);
      console.log('응답 내용:', data);
    }
  } catch (error) {
    console.error('API 테스트 오류:', error);
  }
};

testSS275API();