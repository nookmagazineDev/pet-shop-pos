const express = require("express");
const cors = require("cors");
const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;
const fs   = require("fs");
const path = require("path");
const os   = require("os");

const app  = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Visual width: Thai chars count as 2 on thermal printers
function vw(str) {
  let w = 0;
  for (const ch of String(str || "")) w += (ch >= "฀" && ch <= "๿") ? 2 : 1;
  return w;
}

// Wrap text into lines no wider than maxW (visual)
function wrapLines(str, maxW) {
  const lines = [];
  let cur = "", curW = 0;
  for (const ch of String(str || "")) {
    const cw = (ch >= "฀" && ch <= "๿") ? 2 : 1;
    if (curW + cw > maxW) { lines.push(cur); cur = ch; curW = cw; }
    else { cur += ch; curW += cw; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

// Right-align value against label on one line
function lineRow(label, value, lineWidth) {
  return label + " ".repeat(Math.max(1, lineWidth - vw(label) - vw(value))) + value;
}

app.post("/print", async (req, res) => {
  try {
    const {
      paperWidth, shopName, shopAddress, shopPhone, shopTaxId,
      footerNote, items, subtotal, tax, total, isTest,
      receiptType, paymentMethod, customerInfo, empName, posId,
      docNo, receiptNo, issuedAt, branchLabel: branchText,
      breakdown, amountText, discountRows, displayGross, displayDiscount,
      cashReceived, changeReturn,
      logoBase64,
    } = req.body;

    const ip = req.body.ip || req.body.printerIp;
    if (!ip) return res.status(400).json({ success: false, message: "Printer IP is required" });

    const width = parseInt(paperWidth) || 80;
    const lineW = width <= 58 ? 32 : 48;

    let printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: `tcp://${ip}`,
      removeSpecialCharacters: false,
      width: lineW,
      options: { timeout: 5000 },
    });

    const fmt = (n) => Number(n || 0).toFixed(2);
    const sep = "-".repeat(lineW);

    // ── Logo ──────────────────────────────────────────────────
    if (logoBase64 && !isTest) {
      try {
        const tmpPath = path.join(os.tmpdir(), "pos_logo_tmp.png");
        fs.writeFileSync(tmpPath, Buffer.from(logoBase64, "base64"));
        await printer.printImage(tmpPath);
        printer.newLine();
      } catch (e) {
        console.log("Logo skipped:", e.message);
      }
    }

    const isFullTaxInvoice = receiptType === "ใบกำกับภาษี";

    // ── Header — ข้อมูลผู้ประกอบการตามที่จดทะเบียนภาษีมูลค่าเพิ่ม ──
    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println(shopName || "Receipt");
    printer.setTextNormal();
    printer.bold(false);
    if (shopAddress) printer.println(shopAddress);
    if (shopPhone)   printer.println("โทร. " + shopPhone);
    if (shopTaxId)   printer.println("เลขประจำตัวผู้เสียภาษี " + shopTaxId);
    printer.println(branchText || "สำนักงานใหญ่");

    printer.println(sep);
    const headerTitle = isTest
      ? "** TEST PRINT **"
      : isFullTaxInvoice
        ? "ใบกำกับภาษี / ใบเสร็จรับเงิน"
        : "ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ";
    printer.println(headerTitle);
    if (!isTest && !docNo) printer.println("** ตัวอย่าง - ยังไม่ออกเลขที่ **");

    printer.alignLeft();
    // วันที่ต้องเป็นวันที่ของรายการขาย ไม่ใช่เวลาที่กดพิมพ์ (พิมพ์ซ้ำต้องได้วันเดิม)
    const issuedDate = issuedAt ? new Date(issuedAt) : new Date();
    const issuedValid = !isNaN(issuedDate.getTime()) ? issuedDate : new Date();
    printer.println(lineRow("วันที่", issuedValid.toLocaleString("th-TH", { hour12: false }), lineW));
    if (!isTest) {
      printer.println(lineRow("เลขที่", String(docNo || "-"), lineW));
      if (isFullTaxInvoice && receiptNo) printer.println(lineRow("เลขที่ใบเสร็จ", String(receiptNo), lineW));
      if (empName || posId) printer.println(lineRow("เครื่อง/พนักงาน", `${posId || "POS-01"} / ${empName || "-"}`, lineW));
    }

    // ข้อมูลผู้ซื้อ — บังคับบนใบกำกับภาษีเต็มรูป (ม.86/4(4))
    if (customerInfo && isFullTaxInvoice) {
      printer.println(sep);
      printer.println("ผู้ซื้อ: " + (customerInfo.customerName || customerInfo.name || "-"));
      wrapLines("ที่อยู่: " + (customerInfo.customerAddress || customerInfo.address || "-"), lineW).forEach(l => printer.println(l));
      printer.println("เลขประจำตัวผู้เสียภาษี: " + (customerInfo.customerTaxId || customerInfo.taxId || "-"));
      printer.println("สาขา: " + (customerInfo.customerBranch || "สำนักงานใหญ่"));
    }

    // ── Items ─────────────────────────────────────────────────
    printer.println(sep);

    if (items && items.length > 0) {
      items.forEach(item => {
        const qty      = Number(item.qty ?? item.quantity ?? 1);
        // ใบกำกับภาษีเต็มรูปส่งราคาแบบไม่รวม VAT มาให้ (แยกมูลค่าสินค้าออกจากภาษี)
        const hasExVat = item.amountExVat !== undefined && item.unitExVat !== undefined;
        const price    = hasExVat ? Number(item.unitExVat) : Number(item.price || item.Price || 0);
        const lineTot  = hasExVat ? Number(item.amountExVat) : price * qty;
        const barcode  = String(item.Barcode || item.barcode || "").trim();
        const rawName  = (item.name || item.Name || "Item") + (item.vatStatus === "NON VAT" ? " (N)" : "");
        const totalStr = fmt(lineTot);

        // Barcode line
        if (barcode) printer.println(`  ${barcode}`);

        // Item name — wrap to full line width
        const nameLines = wrapLines(rawName, lineW - 2);
        nameLines.forEach(l => printer.println("  " + l));

        // Price line: right-aligned total
        const pricePart = `  x${qty}  @${fmt(price)}`;
        printer.println(pricePart + " ".repeat(Math.max(1, lineW - vw(pricePart) - totalStr.length)) + totalStr);
      });
    }

    // ── สรุปยอด ───────────────────────────────────────────────
    // ต้องพิมพ์ให้ครบทั้ง มูลค่ายกเว้นภาษี / ฐานภาษี / VAT
    // และผลรวมสามบรรทัดต้องเท่ากับยอดสุทธิพอดี (เดิมพิมพ์ Subtotal + VAT
    // ซึ่งบวกกันแล้วไม่เท่ากับ Total เพราะ Subtotal เป็นยอดก่อนหักส่วนลด)
    const bd = breakdown || {};
    const netTotal   = Number(bd.netTotal ?? total ?? 0);
    const vatAmount  = Number(bd.vatAmount ?? tax ?? 0);
    const vatableEx  = Number(bd.vatableExVat ?? (vatAmount > 0 ? vatAmount * 100 / 7 : 0));
    const nonVat     = Number(bd.nonVatAmount ?? Math.max(0, netTotal - vatableEx - vatAmount));
    // ใช้ยอดที่หน้าจอคำนวณไว้ (อยู่ฐานเดียวกับคอลัมน์จำนวนเงินที่พิมพ์)
    // เพื่อให้ รวมมูลค่าสินค้า - ส่วนลด = ยกเว้นภาษี + ฐานภาษี เสมอ
    const grossValue = Number(displayGross ?? bd.grossSubtotal ?? subtotal ?? netTotal);
    const totalDisc  = Number(displayDiscount ?? bd.discount ?? 0);

    printer.println(sep);
    printer.println(lineRow("รวมมูลค่าสินค้า", fmt(grossValue), lineW));

    (discountRows || []).forEach(d => {
      const label = String(d.label || "ส่วนลด");
      const nameLines = wrapLines(label, lineW - 10);
      nameLines.forEach((l, i) => {
        if (i === nameLines.length - 1) printer.println(lineRow(l, "-" + fmt(d.amount), lineW));
        else printer.println(l);
      });
    });
    if (totalDisc > 0) printer.println(lineRow("หักส่วนลด", "-" + fmt(totalDisc), lineW));

    printer.println(sep);
    printer.println(lineRow("มูลค่าสินค้ายกเว้นภาษี", fmt(nonVat), lineW));
    printer.println(lineRow("มูลค่าสินค้าที่ต้องเสียภาษี", fmt(vatableEx), lineW));
    printer.println(lineRow("ภาษีมูลค่าเพิ่ม 7%", fmt(vatAmount), lineW));
    printer.println(sep);
    printer.bold(true);
    printer.println(lineRow("จำนวนเงินรวมทั้งสิ้น", fmt(netTotal), lineW));
    printer.bold(false);
    if (amountText) {
      printer.alignCenter();
      printer.println("(" + amountText + ")");
      printer.alignLeft();
    }

    // ── Payments ──────────────────────────────────────────────
    if (paymentMethod && !isTest) {
      printer.println(sep);
      const payStr = String(paymentMethod);
      const payList = payStr.includes(":")
        // แยกตาม "+" แล้ว trim เอง — เดิมแยกด้วย " + " ซึ่งพังถ้าเว้นวรรคไม่ตรงแบบ
        ? payStr.split("+").map(p => p.trim()).filter(Boolean).map(p => {
            const ci = p.indexOf(":");
            if (ci < 0) return { method: p, amount: 0 };
            return { method: p.slice(0, ci).trim(), amount: parseFloat(p.slice(ci + 1)) || 0 };
          })
        : [{ method: payStr, amount: Number(netTotal) }];
      const paidSum = payList.reduce((s, p) => s + p.amount, 0);
      payList.forEach(p => printer.println(lineRow(
        p.method,
        fmt(payList.length === 1 && paidSum === 0 ? netTotal : p.amount),
        lineW)));
      if (Number(cashReceived) > 0) printer.println(lineRow("รับเงินสด", fmt(cashReceived), lineW));
      if (Number(changeReturn) > 0) printer.println(lineRow("เงินทอน", fmt(changeReturn), lineW));
    }

    // ── Footer ────────────────────────────────────────────────
    printer.println(sep);
    printer.alignCenter();
    // ข้อความบังคับสำหรับใบกำกับภาษีอย่างย่อ (ม.86/6(5))
    if (!isTest) printer.println("ราคาสินค้ารวมภาษีมูลค่าเพิ่มแล้ว");
    if (footerNote) printer.println(footerNote);
    if (isTest) printer.println("--- Test Print ---");

    printer.newLine();
    printer.newLine();
    printer.cut();

    await printer.execute();
    console.log(`Print job sent to ${ip}`);
    res.json({ success: true, message: "Printed successfully" });

  } catch (error) {
    console.error("Print Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to connect to printer" });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Print server is running" });
});

app.listen(port, "0.0.0.0", () => {
  const nets = os.networkInterfaces();
  const lanIps = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) lanIps.push(net.address);
    }
  }
  console.log("\n  Print Server started!");
  console.log(`    Local  : http://localhost:${port}`);
  lanIps.forEach(ip => console.log(`    Network: http://${ip}:${port}  <-- use this IP on mobile`));
  console.log("\n  App -> Printer Settings -> Print Server URL -> paste Network IP above");
  console.log("  Set Printer IP to match the actual IP of your Thermal Printer\n");
});
