import * as XLSX from 'xlsx';

const r2 = (n) => Math.round(n * 100) / 100;

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
 * @param {Array}  opts.headers - [{ key, label }]
 * @param {Array}  opts.rows - array of plain objects
 * @param {object|null} opts.totals - { key: value } for grand total row, or null
 * @param {string} opts.sheetName
 * @param {string} opts.fileName
 */
export const exportReportToExcel = ({ title, company, period, headers, rows, totals, sheetName, fileName }) => {
  if (!rows || rows.length === 0) {
    alert("ไม่มีข้อมูลที่จะส่งออกดาวน์โหลด");
    return;
  }

  const aoa = [];

  // Row 1: Report title
  aoa.push([title]);

  // Row 2: Company name + branch + tax id
  aoa.push([
    `สถานที่ประกอบการ: ${company.name}  สาขา: ${company.branch}  เลขประจำตัวผู้เสียภาษี: ${company.taxId}`
  ]);

  // Row 3: Address
  aoa.push([`ที่อยู่: ${company.address}`]);

  // Row 4: Period
  aoa.push([`period: ${period}`]);

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

  // Column widths (auto)
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.label.length * 2, 12) }));

  // Merge title row across all columns
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

/** Parse CartDetails and split revenue into nonVAT / vatableTotal */
export const getCartVatSplit = (cartDetails, productsArr) => {
  let nonVAT = 0, vatableTotal = 0;
  try {
    const cart = typeof cartDetails === 'string' ? JSON.parse(cartDetails) : cartDetails;
    if (Array.isArray(cart)) {
      cart.forEach(item => {
        const bc = String(item.Barcode || item.barcode || "");
        const prod = (productsArr || []).find(p => String(p.Barcode) === bc) || {};
        const vatStatus = prod.VatStatus || item.VatStatus || "VAT";
        const revenue = r2((parseFloat(item.price || item.Price || 0)) * (parseFloat(item.qty || 1)));
        if (vatStatus === "NON VAT") nonVAT += revenue;
        else vatableTotal += revenue;
      });
    }
  } catch (e) {}
  return { nonVAT: r2(nonVAT), vatableTotal: r2(vatableTotal) };
};

/** Format Thai period string */
export const formatThaiPeriod = (startDate, endDate) => {
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  const s = new Date(startDate).toLocaleDateString("th-TH", opts);
  const e = new Date(endDate).toLocaleDateString("th-TH", opts);
  return s === e ? s : `${s} - ${e}`;
};
