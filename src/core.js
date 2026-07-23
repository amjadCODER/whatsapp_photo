export function normalizePhone(value, countryCode = '966') {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) return `${countryCode}${digits.slice(1)}`;
  if (digits.length <= 10 && !digits.startsWith(countryCode)) return `${countryCode}${digits}`;
  return digits;
}

export function fillTemplate(template, contact) {
  return String(template).replace(/\{([^{}]+)\}/g, (_, key) => {
    const value = contact[key.trim()];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function detectPhoneColumn(headers) {
  const candidates = ['phone', 'mobile', 'number', 'رقم الجوال', 'الجوال', 'رقم الهاتف', 'رقم'];
  return headers.find((header) => candidates.includes(String(header).trim().toLowerCase())) ?? null;
}

export function createQueue(rows, countryCode = '966') {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const phoneColumn = detectPhoneColumn(headers);
  if (!phoneColumn) throw new Error('لم يتم العثور على عمود رقم الجوال');

  const seen = new Set();
  return rows.flatMap((row, index) => {
    const phone = normalizePhone(row[phoneColumn], countryCode);
    if (!phone || seen.has(phone)) return [];
    seen.add(phone);
    return [{ id: `${index}-${phone}`, phone, data: row, status: 'waiting' }];
  });
}

export function queueStats(queue) {
  return queue.reduce((stats, item) => {
    stats.total += 1;
    if (item.status === 'sent') stats.sent += 1;
    if (item.status === 'waiting' || item.status === 'opened') stats.remaining += 1;
    return stats;
  }, { total: 0, sent: 0, remaining: 0 });
}
