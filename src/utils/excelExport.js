import * as XLSX from 'xlsx';
export { breakdownFromTransaction, breakdownFromCart } from './vat';

// Original simple export (kept for compatibility)
export const exportToExcel = (dataArray, sheetName, fileName) => {
  if (!dataArray || dataArray.length === 0) {
    alert("ไม่มีข้อมูลที่จะส่งออกดาวน์โหลด");
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(dataArray);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

/**
 * Export with company header + VAT columns
 * @param {object} opts
 * @param {string} opts.title - Report title (e.g. "รายงานภาษีขาย")
 * @param {object} opts.company - { name, branch, taxId, address }
 * @param {string} opts.period - Date range string
 * @param {string} opts.periodLabel - ป้ายกำกับช่วงเวลา เช่น "เดือนภาษี"
 * @param {Array}  opts.headers - [{ key, label }]
 * @param {Array}  opts.rows - array of plain objects
 * @param {object|null} opts.totals - { key: value } for grand total row, or null
 * @param {string} opts.sheetName
 * @param {string} opts.fileName
 */
export const exportReportToExcel = ({ title, company, period, periodLabel = "ช่วงวันที่", headers, rows, totals, sheetName, fileName, textCols = [] }) => {
  if (!rows || rows.length === 0) {
    alert("ไม่มีข้อมูลที่จะส่งออกดาวน์โหลด");
    return;
  }

  const aoa = [];

  // Row 1: Report title
  aoa.push([title]);

  // Row 2: Company name + branch + tax id
  aoa.push([
    `ชื่อสถานประกอบการ: ${company.name}    ${company.branch}    เลขประจำตัวผู้เสียภาษี: ${company.taxId}`
  ]);

  // Row 3: Address
  aoa.push([`ที่อยู่: ${company.address}`]);

  // Row 4: Period (เดือนภาษี/ปีภาษี ตามแบบรายงานภาษีขาย)
  aoa.push([`${periodLabel}: ${period}`]);

  // Row 5: Empty separator
  aoa.push([]);

  // Row 6: Column headers
  aoa.push(headers.map(h => h.label));

  // Data rows
  rows.forEach(row => {
    aoa.push(headers.map(h => (row[h.key] !== undefined && row[h.key] !== null) ? row[h.key] : ''));
  });

  // Grand total row
  if (totals) {
    aoa.push(headers.map(h => (totals[h.key] !== undefined && totals[h.key] !== null) ? totals[h.key] : ''));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Force text format for specified columns (prevents scientific notation for IDs/codes)
  if (textCols.length > 0) {
    const dataStartRow = 6; // rows 0-4 = header block, row 5 = col headers, row 6+ = data
    const totalDataRows = rows.length + (totals ? 1 : 0);
    textCols.forEach(key => {
      const colIdx = headers.findIndex(h => h.key === key);
      if (colIdx === -1) return;
      for (let r = dataStartRow; r < dataStartRow + totalDataRows; r++) {
        const addr = XLSX.utils.encode_cell({ r, c: colIdx });
        if (ws[addr]) {
          ws[addr].t = 's';
          ws[addr].z = '@';
        } else {
          ws[addr] = { t: 's', v: '', z: '@' };
        }
      }
    });
  }

  // Column widths (auto)
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.label.length * 2, 14) }));

  // Merge title rows across all columns
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: headers.length - 1 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

/** Format Thai period string */
export const formatThaiPeriod = (startDate, endDate) => {
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  const s = new Date(startDate).toLocaleDateString("th-TH", opts);
  const e = new Date(endDate).toLocaleDateString("th-TH", opts);
  return s === e ? s : `${s} - ${e}`;
};
