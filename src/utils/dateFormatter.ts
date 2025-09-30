/**
 * 날짜 포맷팅 유틸리티 함수들
 */

/**
 * ISO 주간 형식(2023-W48)을 한국어 형식(23년12월1주)으로 변환
 * @param isoWeek - ISO 주간 형식 문자열 (예: "2023-W48")
 * @returns 한국어 형식 문자열 (예: "23년12월1주")
 */
export const formatWeekLabel = (isoWeek: string): string => {
  if (!isoWeek || !isoWeek.includes('-W')) {
    return isoWeek; // ISO 주간 형식이 아니면 원본 반환
  }

  try {
    const [yearStr, weekStr] = isoWeek.split('-W');
    const year = parseInt(yearStr);
    const week = parseInt(weekStr);

    if (isNaN(year) || isNaN(week)) {
      return isoWeek; // 파싱 실패 시 원본 반환
    }

    // ISO 주간을 실제 날짜로 변환
    // ISO 주간의 첫 번째 날(월요일)을 구함
    const jan4 = new Date(year, 0, 4); // 1월 4일
    const jan4Day = jan4.getDay() || 7; // 일요일을 7로 변환
    const firstMonday = new Date(jan4.getTime() - (jan4Day - 1) * 24 * 60 * 60 * 1000);
    
    // 해당 주의 월요일 날짜 계산
    const targetWeekMonday = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    
    const month = targetWeekMonday.getMonth() + 1; // 0-based이므로 +1
    const shortYear = year.toString().slice(-2); // 연도 뒤 2자리
    
    // 해당 월의 첫 번째 주 계산
    const firstDayOfMonth = new Date(year, targetWeekMonday.getMonth(), 1);
    const firstDayOfMonthDay = firstDayOfMonth.getDay() || 7; // 일요일을 7로 변환
    
    // 해당 월의 첫 번째 월요일 찾기
    const firstMondayOfMonth = new Date(firstDayOfMonth.getTime() + (8 - firstDayOfMonthDay) * 24 * 60 * 60 * 1000);
    if (firstDayOfMonthDay === 1) {
      // 1일이 월요일인 경우
      firstMondayOfMonth.setTime(firstDayOfMonth.getTime());
    }
    
    // 해당 월에서 몇 번째 주인지 계산
    const weekOfMonth = Math.floor((targetWeekMonday.getTime() - firstMondayOfMonth.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    
    // 음수나 0이 나오는 경우 처리 (이전 달의 마지막 주)
    if (weekOfMonth <= 0) {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? Number(shortYear) - 1 : shortYear;
      
      // 이전 달의 마지막 주 계산
      const lastDayOfPrevMonth = new Date(year, targetWeekMonday.getMonth(), 0);
      const lastMondayOfPrevMonth = new Date(lastDayOfPrevMonth.getTime() - (lastDayOfPrevMonth.getDay() || 7 - 1) * 24 * 60 * 60 * 1000);
      const firstMondayOfPrevMonth = new Date(year, lastDayOfPrevMonth.getMonth(), 1);
      const firstDayOfPrevMonthDay = firstMondayOfPrevMonth.getDay() || 7;
      
      if (firstDayOfPrevMonthDay !== 1) {
        firstMondayOfPrevMonth.setTime(firstMondayOfPrevMonth.getTime() + (8 - firstDayOfPrevMonthDay) * 24 * 60 * 60 * 1000);
      }
      
      const lastWeekOfPrevMonth = Math.floor((lastMondayOfPrevMonth.getTime() - firstMondayOfPrevMonth.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      
      return `${prevYear}년${prevMonth}월${lastWeekOfPrevMonth}주`;
    }
    
    // 해당 월을 넘어가는 경우 처리 (다음 달의 첫 번째 주)
    const lastDayOfMonth = new Date(year, targetWeekMonday.getMonth() + 1, 0);
    if (targetWeekMonday.getTime() > lastDayOfMonth.getTime()) {
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? parseInt(shortYear) + 1 : shortYear;
      return `${nextYear}년${nextMonth}월1주`;
    }
    
    return `${shortYear}년${month}월${weekOfMonth}주`;
  } catch (error) {
    console.warn('주간 라벨 포맷팅 오류:', error);
    return isoWeek; // 오류 발생 시 원본 반환
  }
};

/**
 * X축 라벨 포맷팅 함수 - 기간에 따라 다른 포맷 적용
 * @param value - 날짜 값
 * @param interval - 기간 타입 ('weekly', 'monthly', 'yearly')
 * @returns 포맷된 라벨 문자열
 */
export const formatXAxisLabel = (value: string, interval: string): string => {
  if (interval === 'weekly') {
    return formatWeekLabel(value);
  }
  
  // 월간: '25년 1월' 형태로 변경
  if (interval === 'monthly') {
    const date = new Date(value);
    const year = date.getFullYear().toString().slice(-2);
    const month = date.getMonth() + 1;
    return `${year}년 ${month}월`;
  }
  
  // 연간: '25년' 형태로 변경
  if (interval === 'yearly') {
    const date = new Date(value);
    const year = date.getFullYear().toString().slice(-2);
    return `${year}년`;
  }

  return value;
};