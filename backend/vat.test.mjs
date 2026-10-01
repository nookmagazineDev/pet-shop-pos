// ทดสอบตรรกะฝั่ง backend (คัดเฉพาะฟังก์ชันบริสุทธิ์ ไม่ต้องใช้ Google Sheets)
import fs from 'fs';
const src = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');

const pick = (name) => {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`not found: ${name}`);
  let depth = 0, i = src.indexOf('{', start);
  const from = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
};

const mod = new Function(`${pick('_money')}\n${pick('_resolveVatBreakdown')}\nreturn { _money, _resolveVatBreakdown };`)();

let fail = 0;
const check = (name, cond, extra = '') => { if (!cond) { console.log('FAIL:', name, extra); fail++; } };
const r2 = n => Math.round(n * 100) / 100;

// 1) หน้าจอส่งโครงสร้างมาครบ
let bd = mod._resolveVatBreakdown({ totalAmount: 967, tax: 48.21, vatableAmount: 688.65, nonVatAmount: 230.14, grossSubtotal: 1216.5 });
check('ครบ: ผลรวม = ยอดสุทธิ', r2(bd.nonVat + bd.vatable + bd.vat) === bd.total, JSON.stringify(bd));
check('ครบ: ค่าตรงตามที่ส่งมา', bd.vatable === 688.65 && bd.nonVat === 230.14 && bd.vat === 48.21, JSON.stringify(bd));

// 2) client รุ่นเก่า ส่งแค่ total + tax
bd = mod._resolveVatBreakdown({ totalAmount: 1070, tax: 70 });
check('เก่า: ผลรวม = ยอดสุทธิ', r2(bd.nonVat + bd.vatable + bd.vat) === bd.total, JSON.stringify(bd));
check('เก่า: ไม่มีสินค้ายกเว้นภาษี', bd.nonVat === 0, JSON.stringify(bd));

// 3) บิลที่ไม่มี VAT เลย (แพคเกจ/บริการยกเว้นภาษี)
bd = mod._resolveVatBreakdown({ totalAmount: 500, tax: 0, vatableAmount: 0, nonVatAmount: 500 });
check('ยกเว้นทั้งบิล', bd.nonVat === 500 && bd.vatable === 0 && bd.vat === 0, JSON.stringify(bd));

// 4) ข้อมูลเพี้ยน: ฐานภาษี + VAT เกินยอดสุทธิ → ต้องไม่ได้ค่าติดลบ
bd = mod._resolveVatBreakdown({ totalAmount: 100, tax: 50, vatableAmount: 900 });
check('ข้อมูลเพี้ยน: ไม่มีค่าติดลบ', bd.nonVat >= 0 && bd.vatable >= 0, JSON.stringify(bd));
check('ข้อมูลเพี้ยน: ผลรวมยังเท่ายอดสุทธิ', r2(bd.nonVat + bd.vatable + bd.vat) === bd.total, JSON.stringify(bd));

// 5) ค่าที่ไม่ใช่ตัวเลข
bd = mod._resolveVatBreakdown({ totalAmount: "", tax: null });
check('ค่าว่าง: ได้ศูนย์ ไม่ใช่ NaN', bd.total === 0 && bd.vat === 0 && bd.nonVat === 0, JSON.stringify(bd));

console.log(fail === 0 ? '✅ backend: ผ่านทุกข้อ' : `❌ backend: ไม่ผ่าน ${fail} ข้อ`);
process.exit(fail === 0 ? 0 : 1);
