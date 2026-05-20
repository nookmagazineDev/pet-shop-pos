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
      paperWidth, shopName, shopAddress, shopPhone, shopTaxId, shopBranch,
      footerNote, items, subtotal, tax, total, isTest,
      receiptType, paymentMethod, customerInfo, empName, recNo,
      discountAmount, freeItemLines, couponDiscount, couponLines,
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

    // ── Header ────────────────────────────────────────────────
    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println(shopName || "Receipt");
    printer.setTextNormal();
    printer.bold(false);
    if (shopAddress) printer.println(shopAddress);
    if (shopPhone)   printer.println("Tel: " + shopPhone);
    if (shopTaxId)   printer.println("Tax ID: " + shopTaxId + (shopBranch ? ` (${shopBranch})` : ""));

    printer.println(sep);
    const headerTitle = isTest
      ? "** TEST PRINT **"
      : receiptType === "ใบกำกับภาษี"
        ? "ใบเสร็จรับเงิน/ใบกำกับภาษี"
        : "ใบเสร็จรับเงิน/ใบกำกับภาษีอย่างย่อ";
    printer.println(headerTitle);

    printer.alignLeft();
    printer.println("Date: " + new Date().toLocaleString("en-GB"));
    if (recNo && !isTest) printer.println("No: " + recNo);
    if (paymentMethod && !isTest) printer.println("Payment: " + paymentMethod);

    if (customerInfo && receiptType === "ใบกำกับภาษี") {
      printer.println(sep);
      printer.println("Customer: " + (customerInfo.customerName || "-"));
      printer.println("Address:  " + (customerInfo.customerAddress || "-"));
      printer.println("Tax ID:   " + (customerInfo.customerTaxId || "-"));
    }

    // ── Items ─────────────────────────────────────────────────
    printer.println(sep);

    if (items && items.length > 0) {
      items.forEach(item => {
        const qty      = item.qty || 1;
        const price    = Number(item.price || item.Price || 0);
        const barcode  = String(item.Barcode || item.barcode || "").trim();
        const rawName  = (item.name || item.Name || "Item") + (item.vatStatus === "NON VAT" ? " (N)" : "");
        const totalStr = fmt(price * qty);

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

    // ── Discounts ─────────────────────────────────────────────
    const hasFree    = freeItemLines && freeItemLines.length > 0;
    const hasBillDisc = Number(discountAmount || 0) > 0;
    const resolvedCouponLines = (couponLines && couponLines.length > 0)
      ? couponLines
      : (Number(couponDiscount || 0) > 0 ? [{ name: "Coupon", discount: couponDiscount }] : []);

    if (hasFree || hasBillDisc || resolvedCouponLines.length > 0) {
      printer.println(sep);
      if (hasFree) {
        freeItemLines.forEach(fi => {
          printer.println(lineRow("Free: " + fi.name, "-" + fmt(fi.price * fi.qty), lineW));
        });
      }
      if (hasBillDisc) {
        printer.println(lineRow("Promo Discount", "-" + fmt(discountAmount), lineW));
      }
      resolvedCouponLines.forEach(cl => {
        const label = String(cl.name || "Coupon");
        const nameLines = wrapLines(label, lineW - 10);
        nameLines.forEach((l, i) => {
          if (i === nameLines.length - 1) {
            printer.println(lineRow(l, "-" + fmt(cl.discount), lineW));
          } else {
            printer.println(l);
          }
        });
      });
    }

    // ── Totals ────────────────────────────────────────────────
    printer.println(sep);
    printer.println(lineRow("Subtotal", fmt(subtotal), lineW));
    printer.println(lineRow("VAT 7%",   fmt(tax),      lineW));
    printer.bold(true);
    printer.println(lineRow("Total (THB)", fmt(total), lineW));
    printer.bold(false);

    // ── Payments ──────────────────────────────────────────────
    if (paymentMethod && !isTest) {
      printer.println(sep);
      const payList = String(paymentMethod).includes(":")
        ? String(paymentMethod).split(" + ").map(p => {
            const [m, a] = p.split(":");
            return { method: m.trim(), amount: parseFloat(a) || 0 };
          })
        : [{ method: paymentMethod, amount: Number(total) }];
      payList.forEach(p => printer.println(lineRow(p.method, fmt(p.amount || total), lineW)));
    }

    // ── Footer ────────────────────────────────────────────────
    printer.println(sep);
    printer.alignCenter();
    if (footerNote) printer.println(footerNote);
    if (empName && !isTest) printer.println("Staff: " + empName);
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
