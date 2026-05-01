// 데이터베이스 데이터 확인 스크립트

async function checkData() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('📊 데이터베이스 데이터 확인 시작...\n');
  
  // 1. 레벨별 카테고리 확인
  console.log('1. 레벨별 카테고리 확인');
  for (let level = 1; level <= 3; level++) {
    try {
      const response = await fetch(`${baseUrl}/api/categories?level=${level}`);
      const data = await response.json();
      
      if (response.ok) {
        console.log(`   레벨 ${level}: ${data.length}개 카테고리`);
        if (data.length > 0) {
          console.log(`     예시: ${data.slice(0, 5).join(', ')}`);
        }
      } else {
        console.log(`   레벨 ${level}: 오류 - ${data.error}`);
      }
    } catch (error) {
      console.log(`   레벨 ${level}: 실패 - ${error.message}`);
    }
  }
  
  // 2. 공통자재 카테고리의 자재 확인
  console.log('\n2. 공통자재 카테고리의 자재 확인');
  try {
    const response = await fetch(`${baseUrl}/api/materials-by-category?level=1&categoryName=공통자재`);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`   공통자재: ${data.length}개 자재`);
      if (data.length > 0) {
        console.log(`     첫 번째 자재 전체:`, data[0]);
        
        // 자재명 추출 시도
        const materialNames = data.map(item => {
          if (typeof item === 'string') return item;
          return item.specification || item.material_name || item.name || JSON.stringify(item);
        });
        console.log(`     자재명들: ${materialNames.slice(0, 5).join(', ')}`);
        
        // 첫 번째 자재로 가격 데이터 테스트
        const firstMaterial = materialNames[0];
        console.log(`\n3. 자재 가격 데이터 테스트 (${firstMaterial})`);
        
        const priceTestData = {
          materials: [firstMaterial],
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          interval: 'monthly'
        };
        
        const pricesResponse = await fetch(`${baseUrl}/api/materials/prices`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(priceTestData)
        });
        
        const pricesData = await pricesResponse.json();
        
        if (pricesResponse.ok) {
          console.log(`   가격 데이터: ${pricesData.length}개 레코드`);
          if (pricesData.length > 0) {
            console.log(`     첫 번째 레코드:`, pricesData[0]);
          }
        } else {
          console.log(`   가격 데이터 오류: ${pricesData.error}`);
        }
      }
    } else {
      console.log(`   공통자재 오류: ${data.error}`);
    }
  } catch (error) {
    console.log(`   공통자재 실패: ${error.message}`);
  }
  
  console.log('\n📊 데이터 확인 완료');
}

checkData().catch(console.error);