// MEB Akademik Takvim Hesaplayıcı
export function getAcademicInfo(targetDate = new Date()) {
  const d = new Date(targetDate);
  const month = d.getMonth() + 1; // 1 - 12
  const year = d.getFullYear();

  let academicYear = '';
  let term = '';
  let termKey = '';

  if (month >= 9) {
    // Eylül, Ekim, Kasım, Aralık
    academicYear = `${year}-${year + 1}`;
    term = '1. Dönem';
    termKey = `${year}-${year + 1}-1`;
  } else if (month === 1) {
    // Ocak (1. Dönem Sonu)
    academicYear = `${year - 1}-${year}`;
    term = '1. Dönem';
    termKey = `${year - 1}-${year}-1`;
  } else if (month >= 2 && month <= 6) {
    // Şubat - Haziran (2. Dönem)
    academicYear = `${year - 1}-${year}`;
    term = '2. Dönem';
    termKey = `${year - 1}-${year}-2`;
  } else {
    // Temmuz, Ağustos (Yaz Dönemi)
    academicYear = `${year - 1}-${year}`;
    term = 'Yaz Tatili';
    termKey = `${year - 1}-${year}-yaz`;
  }

  return {
    academicYear,
    term,
    termKey,
    label: `${academicYear} • ${term}`,
  };
}

// Bir kaydın tarihinin seçilen filtreye uyup uymadığını kontrol eder
export function matchesPeriod(dateString, periodType = 'term') {
  if (periodType === 'all') return true;
  if (!dateString) return false;

  const recordDate = new Date(dateString);
  const now = new Date();

  if (periodType === 'month') {
    return (
      recordDate.getFullYear() === now.getFullYear() &&
      recordDate.getMonth() === now.getMonth()
    );
  }

  if (periodType === 'term') {
    const currentInfo = getAcademicInfo(now);
    const recordInfo = getAcademicInfo(recordDate);
    return currentInfo.termKey === recordInfo.termKey;
  }

  return true;
}