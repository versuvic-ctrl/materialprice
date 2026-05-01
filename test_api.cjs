// API 테스트 스크립트
// Node.js 18+ 내장 fetch 사용

async function testAPI() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 API 테스트 시작...\n');
  
  // 1. Categories API 테스트 (level 파라미터 추가)
  console.log('1. Categories API 테스트');
  try {
    const categoriesResponse = await fetch(`${baseUrl}/api/categories?level=1`);
    const categoriesData = await categoriesResponse.json();
    
    if (categoriesResponse.ok) {
      console.log('✅ Categories API 성공:', categoriesData.length ? `${categoriesData.length}개 카테고리` : '데이터 없음');
      if (categoriesData.length > 0) {
        console.log('   샘플 카테고리:', categoriesData.slice(0, 3));
      }
    } else {
      console.log('❌ Categories API 실패:', categoriesData.error);
    }
  } catch (error) {
    console.log('❌ Categories API 실패:', error.message);
  }
  
  // 2. Materials/Prices API 테스트
  console.log('\n2. Materials/Prices API 테스트');
  try {
    const testData = {
      materials: ['강관', '동관', '스테인리스강관'],
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      interval: 'monthly'
    };
    
    const pricesResponse = await fetch(`${baseUrl}/api/materials/prices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    const pricesData = await pricesResponse.json();
    
    if (pricesResponse.ok) {
      console.log('✅ Materials/Prices API 성공:', pricesData.length ? `${pricesData.length}개 데이터` : '데이터 없음');
      if (pricesData.length > 0) {
        console.log('   샘플 데이터:', pricesData[0]);
      }
    } else {
      console.log('❌ Materials/Prices API 실패:', pricesData.error);
    }
  } catch (error) {
    console.log('❌ Materials/Prices API 실패:', error.message);
  }
  
  // 3. Materials-by-category API 테스트
  console.log('\n3. Materials-by-category API 테스트');
  try {
    const categoryResponse = await fetch(`${baseUrl}/api/materials-by-category?category=관재`);
    const categoryData = await categoryResponse.json();
    console.log('✅ Materials-by-category API 성공:', categoryData.length ? `${categoryData.length}개 자재` : '데이터 없음');
  } catch (error) {
    console.log('❌ Materials-by-category API 실패:', error.message);
  }
  
  console.log('\n🏁 API 테스트 완료');
}

testAPI().catch(console.error);