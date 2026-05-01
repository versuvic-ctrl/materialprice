// 데이터베이스 구조 및 데이터 분석 스크립트

async function analyzeDatabase() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🔍 데이터베이스 구조 분석 시작...\n');
  
  // 1. 모든 레벨의 카테고리 상세 분석
  console.log('1. 카테고리 구조 분석');
  const allCategories = {};
  
  for (let level = 1; level <= 3; level++) {
    try {
      const response = await fetch(`${baseUrl}/api/categories?level=${level}`);
      const categories = await response.json();
      
      if (response.ok) {
        allCategories[level] = categories;
        console.log(`   레벨 ${level}: ${categories.length}개`);
        categories.forEach((cat, idx) => {
          if (idx < 10) console.log(`     - ${cat}`);
        });
        if (categories.length > 10) {
          console.log(`     ... 그 외 ${categories.length - 10}개`);
        }
      }
    } catch (error) {
      console.log(`   레벨 ${level} 오류: ${error.message}`);
    }
  }
  
  // 2. 각 카테고리별 자재 분석
  console.log('\n2. 카테고리별 자재 분석');
  const materialsByCategory = {};
  
  for (let level = 1; level <= 3; level++) {
    if (!allCategories[level]) continue;
    
    console.log(`\n   레벨 ${level} 카테고리들:`);
    for (const category of allCategories[level].slice(0, 5)) { // 처음 5개만 테스트
      try {
        const response = await fetch(`${baseUrl}/api/materials-by-category?level=${level}&categoryName=${encodeURIComponent(category)}`);
        const materials = await response.json();
        
        if (response.ok) {
          materialsByCategory[`${level}-${category}`] = materials;
          console.log(`     ${category}: ${materials.length}개 자재`);
          
          if (materials.length > 0) {
            const sampleMaterials = materials.slice(0, 3).map(m => 
              m.specification || m.material_name || m.name || JSON.stringify(m)
            );
            console.log(`       예시: ${sampleMaterials.join(', ')}`);
          }
        } else {
          console.log(`     ${category}: 오류 - ${materials.error}`);
        }
      } catch (error) {
        console.log(`     ${category}: 실패 - ${error.message}`);
      }
    }
  }
  
  // 3. 실제 자재명으로 가격 데이터 테스트
  console.log('\n3. 가격 데이터 테스트');
  const testMaterials = [];
  
  // 모든 자재에서 실제 자재명 수집
  Object.values(materialsByCategory).forEach(materials => {
    materials.forEach(material => {
      const materialName = material.specification || material.material_name || material.name;
      if (materialName && materialName !== '공통자재' && !testMaterials.includes(materialName)) {
        testMaterials.push(materialName);
      }
    });
  });
  
  console.log(`   수집된 자재명: ${testMaterials.length}개`);
  if (testMaterials.length > 0) {
    console.log(`   예시: ${testMaterials.slice(0, 5).join(', ')}`);
    
    // 처음 몇 개 자재로 가격 데이터 테스트
    const testMaterialsSubset = testMaterials.slice(0, 3);
    
    for (const materialName of testMaterialsSubset) {
      console.log(`\n   ${materialName} 가격 데이터 테스트:`);
      
      const priceTestData = {
        materials: [materialName],
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        interval: 'monthly'
      };
      
      try {
        const pricesResponse = await fetch(`${baseUrl}/api/materials/prices`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(priceTestData)
        });
        
        const pricesData = await pricesResponse.json();
        
        if (pricesResponse.ok) {
          console.log(`     ✅ ${pricesData.length}개 가격 레코드`);
          if (pricesData.length > 0) {
            const sample = pricesData[0];
            console.log(`     샘플: ${sample.date || sample.period} - ${sample.price || sample.value}원`);
          }
        } else {
          console.log(`     ❌ 오류: ${pricesData.error}`);
        }
      } catch (error) {
        console.log(`     ❌ 실패: ${error.message}`);
      }
    }
  } else {
    console.log('   테스트할 자재명을 찾을 수 없습니다.');
  }
  
  // 4. 요약
  console.log('\n📊 분석 요약:');
  console.log(`   - 총 카테고리: 레벨1(${allCategories[1]?.length || 0}), 레벨2(${allCategories[2]?.length || 0}), 레벨3(${allCategories[3]?.length || 0})`);
  console.log(`   - 총 자재 종류: ${testMaterials.length}개`);
  console.log(`   - 함수 상태: get_distinct_categories ✅, get_material_prices 테스트 중`);
  
  console.log('\n🔍 데이터베이스 구조 분석 완료');
}

analyzeDatabase().catch(console.error);