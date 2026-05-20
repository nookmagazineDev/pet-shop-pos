const express = require("express");
const cors = require("cors");
const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;
const http  = require("http");
const https = require("https");
const fs    = require("fs");
const path  = require("path");
const os    = require("os");

async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const tmpPath = path.join(os.tmpdir(), "pos_logo_tmp.png");
    const file = fs.createWriteStream(tmpPath);
    client.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode));
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(tmpPath); });
    }).on("error", (err) => { fs.unlink(tmpPath, () => {}); reject(err); });
  });
}

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Visual width: Thai chars count as 2 (double-byte on thermal printers)
function visualWidth(str) {
  let w = 0;
  for (const ch of String(str || "")) {
    w += (ch >= "฀" && ch <= "๿") ? 2 : 1;
  }
  return w;
}

// Truncate string to max visual width, appending ".." if cut
function truncate(str, maxW) {
  let w = 0, out = "";
  for (const ch of String(str || "")) {
    const cw = (ch >= "฀" && ch <= "๿") ? 2 : 1;
    if (w + cw + 2 > maxW) { out += ".."; break; }
    out += ch; w += cw;
  }
  return out;
}

// Right-align value against a left label on one line
function lineRow(label, value, lineWidth) {
  const gap = lineWidth - visualWidth(label) - visualWidth(value);
  return label + " ".repeat(Math.max(1, gap)) + value;
}

app.post("/print", async (req, res) => {
  try {
    const {
      paperWidth, shopName, shopAddress, shopPhone, shopTaxId, shopBranch,
      footerNote, items, subtotal, tax, total, isTest,
      receiptType, paymentMethod, customerInfo, empName, recNo,
      nonVatAdjusted, vatableAdjusted,
      discountAmount, freeItemLines, couponDiscount, couponName,
      logoUrl,
    } = req.body;

    const ip = req.body.ip || req.body.printerIp;
    if (!ip) return res.status(400).json({ success: false, message: "Printer IP is required" });

    const width = parseInt(paperWidth) || 80;
    const lineW = width <= 58 ? 32 : 48;  // printable chars per line

    let printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: `tcp://${ip}`,
      removeSpecialCharacters: false,
      width: lineW,
      options: { timeout: 5000 },
    });

    const fmt = (n) => Number(n || 0).toFixed(2);
    const sep = "-".repeat(lineW);

    // ── Header ────────────────────────────────────────────────
    printer.alignCenter();

    // Logo
    if (logoUrl && !isTest) {
      try {
        const tmpPath = await downloadImage(logoUrl);
        await printer.printImage(tmpPath);
        printer.newLine();
      } catch (e) {
        console.log("Logo skipped:", e.message);
      }
    }

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
    printer.bold(true);
    printer.println("Item" + " ".repeat(lineW - 4 - 3 - 7 - 7) + "Qty" + "  Price" + "   Total");
    printer.bold(false);
    printer.println(sep);

    if (items && items.length > 0) {
      items.forEach(item => {
        const qty   = item.qty || 1;
        const price = Number(item.price || item.Price || 0);
        const total = price * qty;
        const qtyStr   = String(qty);
        const priceStr = fmt(price);
        const totalStr = fmt(total);

        // Max visual width for item name = lineW minus fixed right columns (qty+price+total+spaces)
        const rightW = 1 + qtyStr.length + 2 + priceStr.length + 3 + totalStr.length;
        const nameMaxW = lineW - rightW;
        const rawName = (item.name || item.Name || "Item") + (item.vatStatus === "NON VAT" ? "(N)" : "");
        const name = truncate(rawName, nameMaxW);

        const gap1 = nameMaxW - visualWidth(name);
        const gap2 = 2;  // between qty and price
        const gap3 = 3;  // between price and total
        printer.println(
          name +
          " ".repeat(Math.max(1, gap1)) +
          qtyStr +
          " ".repeat(gap2) +
          priceStr +
          " ".repeat(gap3) +
          totalStr
        );
      });
    }

    // ── Discounts ─────────────────────────────────────────────
    const hasFree     = freeItemLines && freeItemLines.length > 0;
    const hasBillDisc = Number(discountAmount || 0) > 0;
    const hasCoupon   = Number(couponDiscount || 0) > 0;

    if (hasFree || hasBillDisc || hasCoupon) {
      printer.println(sep);
      printer.println("-- Discounts --");

      if (hasFree) {
        freeItemLines.forEach(fi => {
          const label = "Free: " + truncate(fi.name || "Item", lineW - 14);
          const value = "-" + fmt(fi.price * fi.qty);
          printer.println(lineRow(label, value, lineW));
        });
      }
      if (hasBillDisc) {
        printer.println(lineRow("Promo Discount", "-" + fmt(discountAmount), lineW));
      }
      if (hasCoupon) {
        const cLabel = truncate(couponName || "Coupon", lineW - 14);
        printer.println(lineRow(cLabel, "-" + fmt(couponDiscount), lineW));
      }
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
      const payments = String(paymentMethod).includes(":")
        ? String(paymentMethod).split(" + ").map(p => {
            const [m, a] = p.split(":");
            return { method: m.trim(), amount: parseFloat(a) || 0 };
          })
        : [{ method: paymentMethod, amount: Number(total) }];
      payments.forEach(p => {
        printer.println(lineRow(p.method, fmt(p.amount || total), lineW));
      });
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
  const os = require("os");
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
