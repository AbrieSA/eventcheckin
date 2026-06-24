const FORMULA_PREFIX_PATTERN = /^[=+\-@\t\r]/;

export const sanitizeCsvCell = (value) => {
  if (value === null || value === undefined) return '';

  const stringValue = Array.isArray(value)
    ? value.join('; ')
    : String(value);

  const safeValue = FORMULA_PREFIX_PATTERN.test(stringValue)
    ? `'${stringValue}`
    : stringValue;

  return `"${safeValue.replace(/"/g, '""')}"`;
};

export const buildCsv = (headers, rows) => {
  return [
    headers.map(sanitizeCsvCell).join(','),
    ...rows.map((row) => row.map(sanitizeCsvCell).join(','))
  ].join('\n');
};
