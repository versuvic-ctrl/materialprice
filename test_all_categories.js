
async function checkAllCategories() {
  const categories = [
    {
      title: '철금속',
      materials: [
        '스테인리스열연강판 STS304 -  (HR) 3~6',
        '스테인리스열연강판 STS316L -  (HR) 3~6',
        '열연강판 -  3.0 ≤T＜ 4.5, 1,219 ×2,438㎜',
        '고장력철근(하이바)(SD 400) -  D32㎜, 6.230',
        'H형강 -  (소형)H200×B100×t₁5.5×t₂8㎜ 단중21.3㎏/m',
        '고철(철) - 중량철 B'
      ]
    },
    {
      title: '비철금속',
      materials: [
        '니켈 -  원소기호 Ni, 순도 99.9%',
        '알루미늄 -  원소기호 Al, 순도 99.8%',
        '규소 -  원소기호 Si, 중국산, 순도 Si(98.5% 이상) Fe(0.5% 이하)',
        '주석 -  원소기호 Sn, 순도 99.85%',
        '전기동 -  원소기호 Cu, 순도 99.99%',
        '연괴 -  원소기호 Pb, 순도 99.97% 이상'
      ]
    },
    {
      title: '플라스틱',
      materials: [
        'PP -  (Copolymer)',
        'HDPE -  파이프용',
        '경질염화비닐관(일반용배수관)-VG1 (두꺼운 관) - VN SDR 17 호칭경100㎜, 외경114㎜, 두께6.7(최소)㎜, 중량13,636g/본',
        'FRP DUCT(원형) -  호칭경: 4″, 내경: 100㎜',
        '일반용PE하수관-무공관 -  규격100㎜, 외경114㎜, 두께5.5㎜, 중량1.79㎏/m'
      ]
    },
    {
      title: '테프론',
      materials: [
        'UHP PVDF PIPE SDR21 - (1PC=5M) 110㎜',
        'ECTFE PIPE SDR21(1본=5m) -  110㎜'
      ]
    },
    {
      title: '전기자재',
      materials: [
        'FW-CV케이블 -  0.6/1KV 3C 16㎟',
        'FW-CV케이블 -  6/10KV 3C 35㎟',
        'F-GV -  70㎟'
      ]
    },
    {
      title: '토건자재',
      materials: [
        '보통포틀랜드시멘트 -  40㎏ 入',
        '레미콘 - 25 24, 120'
      ]
    }
  ];

  const startDate = '2025-01-01';
  const endDate = '2026-03-11';
  const interval = 'monthly';

  console.log('🚀 모든 카테고리 자재 변동률 전수 조사 시작...');

  for (const cat of categories) {
    console.log(`\n📂 [${cat.title}] 분석 중...`);
    try {
      const response = await fetch('http://localhost:3000/api/materials/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materials: cat.materials, startDate, endDate, interval }),
      });

      const data = await response.json();
      
      cat.materials.forEach(material => {
        const materialData = data.filter(item => (item.specification || '').trim() === material.trim());
        const sortedData = materialData.sort((a, b) => new Date(b.time_bucket).getTime() - new Date(a.time_bucket).getTime());
        
        // 중복 제거
        const uniqueMonthlyData = sortedData.filter((item, index, self) =>
          index === self.findIndex((t) => t.time_bucket === item.time_bucket)
        );

        if (uniqueMonthlyData.length >= 2) {
          const parsePrice = (val) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') return parseFloat(val.replace(/,/g, ''));
            return 0;
          };

          const currentPrice = parsePrice(uniqueMonthlyData[0].average_price);
          const previousPrice = parsePrice(uniqueMonthlyData[1].average_price);

          if (previousPrice !== 0) {
            const change = ((currentPrice - previousPrice) / previousPrice) * 100;
            const status = Math.abs(change) >= 1 ? (change > 0 ? '🔺 상승' : '🔻 하락') : '➖ 변동없음(<1%)';
            console.log(`  - ${material.substring(0, 30)}...: ${change.toFixed(2)}% [${status}]`);
          } else {
            console.log(`  - ${material.substring(0, 30)}...: 이전 가격 0 (계산 불가)`);
          }
        } else {
          console.log(`  - ${material.substring(0, 30)}...: 데이터 부족 (현재: ${uniqueMonthlyData.length}개 월)`);
        }
      });
    } catch (error) {
      console.error(`❌ [${cat.title}] 오류:`, error.message);
    }
  }
}

checkAllCategories();
