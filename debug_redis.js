import { Redis } from "@upstash/redis";

// 환경변수 직접 설정
const redis = new Redis({
  url: "https://obliging-colt-12803.upstash.io",
  token: "ATIDAAIncDE5OTQ5ZmYyYzQyZWE0YzViOGNlNWQ0OTg5ZmRjOWZkNXAxMTI4MDM",
});

async function debugRedis() {
  try {
    console.log("🔍 Redis 키 조회 중...");
    
    // 모든 키 조회
    const allKeys = await redis.keys("*");
    console.log(`📊 총 ${allKeys.length}개의 키 발견:`);
    
    for (const key of allKeys) {
      console.log(`\n🔑 키: ${key}`);
      
      // 키 타입 확인
      const type = await redis.type(key);
      console.log(`   타입: ${type}`);
      
      // 데이터 조회 (문자열인 경우)
      if (type === 'string') {
        const data = await redis.get(key);
        if (typeof data === 'string' && data.length > 200) {
          console.log(`   데이터 (처음 200자): ${data.substring(0, 200)}...`);
        } else {
          console.log(`   데이터:`, data);
        }
      }
    }
    
    // PP 관련 키 특별 조회
    console.log("\n🔍 PP 관련 키 검색:");
    const ppKeys = allKeys.filter(key => key.includes('PP'));
    if (ppKeys.length > 0) {
      for (const key of ppKeys) {
        console.log(`\n🎯 PP 관련 키: ${key}`);
        const data = await redis.get(key);
        console.log("   데이터:", data);
      }
    } else {
      console.log("   PP 관련 키가 없습니다.");
    }
    
  } catch (error) {
    console.error("❌ Redis 조회 오류:", error);
  }
}

debugRedis();