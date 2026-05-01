// Supabase RPC 'get_material_prices'를 통해 정확한 문자열 형식을 확인합니다.
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkSupabaseStrings() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const materials = [
    '스테인리스열연강판 STS304 -  (HR) 3~6',
    '열연강판 -  3.0 ≤T＜ 4.5, 1,219 ×2,438㎜',
    '고장력철근(하이바)(SD 400) -  D32㎜, 6.230',
    'H형강 -  (소형)H200×B100×t₁5.5×t₂8㎜ 단중21.3㎏/m'
  ];

  console.log('RPC get_material_prices 호출 중...');
  const { data, error } = await supabase.rpc('get_material_prices', {
    material_names: materials,
    start_date_str: '2026-02-01',
    end_date_str: '2026-03-11',
    time_interval: 'monthly'
  });

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('RPC 결과 샘플:');
    data.slice(0, 4).forEach((item, i) => {
      console.log(`${i+1}. [${item.specification}] (길이: ${item.specification.length})`);
      console.log(`   가시화: ${item.specification.replace(/ /g, '·')}`);
    });
  } else {
    console.log('데이터가 없습니다.');
  }
}

checkSupabaseStrings();
