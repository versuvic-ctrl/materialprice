// src/config/chartConfig.ts

// --- 1. 차트 설정 정보를 이 파일로 이동 ---
export const DASHBOARD_CHARTS_CONFIG = [
  {
    title: '철금속(Ferrous metals)',
    materials: [
      { id: '스테인리스열연강판 STS304 -  (HR) 3~6', displayName: 'STS304(HR 3~6)', summaryName: 'STS304' },
      { id: '스테인리스열연강판 STS316L -  (HR) 3~6', displayName: 'STS316(HR 3~6)', summaryName: 'STS316' },
      { id: '열연강판 -  3.0 ≤T＜ 4.5, 1,219 ×2,438㎜', displayName: 'SS275(HR, 3~4.5)', summaryName: 'SS275' },
      { id: '고장력철근(하이바)(SD 400) -  D32㎜, 6.230', displayName: '고장력철근(SD400, D32) ', summaryName: '고장력철근' },
      { id: 'H형강 -  (소형)H200×B100×t₁5.5×t₂8㎜ 단중21.3㎏/m', displayName: 'H형강', summaryName: 'H형강'  },
      { id: '고철(철) - 중량철 B', displayName: '고철(중량철)', summaryName: '고철' }
    ]
  },
  {
    title: '비철금속(Non-ferrous metals)',
    materials: [
      { id: '니켈 -  원소기호 Ni, 순도 99.9%', displayName: '니켈(Ni)', summaryName: '니켈' },
      { id: '알루미늄 -  원소기호 Al, 순도 99.8%', displayName: '알루미늄(Al)', summaryName: '알루미늄' },
      { id: '규소 -  원소기호 Si, 중국산, 순도 Si(98.5% 이상) Fe(0.5% 이하)', displayName: '규소(Si)', summaryName: '규소' },
      { id: '주석 -  원소기호 Sn, 순도 99.85%', displayName: '주석(Sn)', summaryName: '주석' },
      { id: '전기동 -  원소기호 Cu, 순도 99.99%', displayName: '전기동(Cu)', summaryName: '전기동' },
      { id: '연괴 -  원소기호 Pb, 순도 99.97% 이상', displayName: '연괴(Pb)', summaryName: '연괴' },
    ]
  },
  {
    title: '플라스틱(Plastics)',
    materials: [
      { id: 'PP -  (Copolymer)', displayName: 'PP', summaryName: 'PP' },
      { id: 'HDPE -  파이프용', displayName: 'HDPE', summaryName: 'HDPE' },
      { id: '경질염화비닐관(일반용배수관)-VG1 (두꺼운 관) - VN SDR 17 호칭경100㎜, 외경114㎜, 두께6.7(최소)㎜, 중량13,636g/본', displayName: 'PVC관(4", VG1)', summaryName: 'PVC관' },
      { id: 'FRP DUCT(원형) -  호칭경: 4″, 내경: 100㎜', displayName: 'FRP DUCT(4")', summaryName: 'FRP DUCT' },
      { id: '일반용PE하수관-무공관 -  규격100㎜, 외경114㎜, 두께5.5㎜, 중량1.79㎏/m', displayName: 'PE관(4")', summaryName: 'PE관' },
    ]
  },
  {
    title: '테프론(Teflon)',
    materials: [
      { id: 'UHP PVDF PIPE SDR21 - (1PC=5M) 110㎜', displayName: 'PVDF관(4",5m)', summaryName: 'PVDF관' },
      { id: 'ECTFE PIPE SDR21(1본=5m) -  110㎜', displayName: 'ECTFE(4",5m)', summaryName: 'ECTFE' },
    ]
  },
  {
    title: '전기자재(Electricals)',
    materials: [
      { id: 'FW-CV케이블 -  0.6/1KV 3C 16㎟', displayName: '저압케이블' },
      { id: 'FW-CV케이블 -  6/10KV 3C 35㎟', displayName: '고압케이블' },
      { id: 'F-GV -  70㎟', displayName: '접지케이블' },
    ]
  },
  {
    title: '토건자재(Structurals)',
    materials: [
      { id: '보통포틀랜드시멘트 -  40㎏ 入', displayName: '시멘트(40㎏)', summaryName: '시멘트' },
      { id: '레미콘 - 25 24, 120', displayName: '레미콘' },
    ]
  }
];

// --- 2. materialInfoMap 생성 로직도 이 파일로 이동 ---
export const materialInfoMap = new Map<string, { displayName: string; summaryName: string }>();
DASHBOARD_CHARTS_CONFIG.forEach(category => {
  category.materials.forEach(material => {
    const displayName = material.displayName.trim();
    const summaryName = (material.summaryName || displayName).trim();
    materialInfoMap.set(material.id, { displayName, summaryName });
  });
});