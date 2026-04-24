const express = require("express");
const cors = require("cors");
const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;

const app = express();
const port = 3001;

// Allow requests from React (localhost:5173 or other)
app.use(cors());
app.use(express.json());

app.post("/print", async (req, res) => {
  try {
    const { paperWidth, shopName, shopAddress, shopPhone, shopTaxId, shopBranch, footerNote, items, subtotal, tax, total, isTest, receiptType, paymentMethod, customerInfo } = req.body;
    const ip = req.body.ip || req.body.printerIp;

    if (!ip) {
      return res.status(400).json({ success: false, message: "Printer IP is required" });
    }

    const type = paperWidth === "58" ? PrinterTypes.STAR : PrinterTypes.EPSON; // Fallback, usually EPSON ESC/POS covers generic 80mm/58mm Chinese printers too
    const width = parseInt(paperWidth) || 80;

    let printer = new ThermalPrinter({
      type: PrinterTypes.EPSON, // standard ESC/POS
      interface: `tcp://${ip}`,
      characterSet: "PC860_PORTUGUESE", // Usually helps with Thai but standard generic ESC/POS needs specific Thai code page config if printing native Thai characters using hardware fonts.
      // Often, printing Thai over raw port requires the printer to support Thai cp874/TIS-620.
      removeSpecialCharacters: false,
      width: width === 58 ? 32 : 48, // 58mm -> 32 chars, 80mm -> 48 chars
      options: {
        timeout: 5000,
      },
    });

    // --- Build Receipt ---
    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    // Since Thai characters over raw TCP to generic printers can be a major pain point due to hardware codepage limitations, 
    // we use basic printing. If Thai comes out as gibberish, the printer's dip switches or software code page must be set to Thai (CP874).
    printer.println(shopName || "Receipt");
    printer.setTextNormal();
    printer.bold(false);
    
    if (shopAddress) printer.println(shopAddress);
    if (shopPhone) printer.println("Tel: " + shopPhone);
    if (shopTaxId) printer.println("Tax ID: " + shopTaxId + (shopBranch ? ` (${shopBranch})` : ""));
    
    printer.drawLine();
    printer.alignCenter();
    printer.println(isTest ? "** TEST PRINT **" : (receiptType === "ใบกำกับภาษี" ? "Tax Invoice (Full)" : "ABB Tax Invoice"));
    
    printer.alignLeft();
    printer.println("Date: " + new Date().toLocaleString("en-GB"));
    if (paymentMethod && !isTest) printer.println("Payment: " + paymentMethod);
    
    if (customerInfo && receiptType === "ใบกำกับภาษี") {
        printer.drawLine();
        printer.println("Customer: " + (customerInfo.customerName || "-"));
        printer.println("Address: " + (customerInfo.customerAddress || "-"));
        printer.println("Tax ID: " + (customerInfo.customerTaxId || "-"));
    }

    printer.drawLine();
    
    // Items
    printer.bold(true);
    printer.tableCustom([
      { text: "Item", align: "LEFT", width: 0.45 },
      { text: "Qty", align: "CENTER", width: 0.15 },
      { text: "Price", align: "RIGHT", width: 0.20 },
      { text: "Total", align: "RIGHT", width: 0.20 },
    ]);
    printer.bold(false);

    if (items && items.length > 0) {
      items.forEach(item => {
        let name = item.name || item.Name || "Item";
        // If name is too long, we might truncate to fit column
        name = name.length > 18 ? name.substring(0, 18) + ".." : name;
        printer.tableCustom([
          { text: name, align: "LEFT", width: 0.45 },
          { text: String(item.qty), align: "CENTER", width: 0.15 },
          { text: Number(item.price || item.Price || 0).toFixed(2), align: "RIGHT", width: 0.20 },
          { text: (Number(item.price || item.Price || 0) * item.qty).toFixed(2), align: "RIGHT", width: 0.20 },
        ]);
      });
    }

    printer.drawLine();
    
    // Totals
    printer.tableCustom([
      { text: "Subtotal", align: "LEFT", width: 0.5 },
      { text: Number(subtotal || 0).toFixed(2), align: "RIGHT", width: 0.5 }
    ]);
    printer.tableCustom([
      { text: "VAT 7%", align: "LEFT", width: 0.5 },
      { text: Number(tax || 0).toFixed(2), align: "RIGHT", width: 0.5 }
    ]);
    
    printer.bold(true);
    printer.tableCustom([
      { text: "Total (THB)", align: "LEFT", width: 0.5 },
      { text: Number(total || 0).toFixed(2), align: "RIGHT", width: 0.5 }
    ]);
    printer.bold(false);

    printer.drawLine();
    printer.alignCenter();
    if (footerNote) printer.println(footerNote);
    if (isTest) printer.println("--- Test Print ---");

    printer.newLine();
    printer.newLine();
    printer.cut();

    let execute = await printer.execute();
    console.log(`Print job sent to ${ip} successfully`);
    
    res.json({ success: true, message: "Printed successfully" });
  } catch (error) {
    console.error("Print Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to connect to printer" });
  }
});

app.listen(port, () => {
  console.log(`Print Bridge Server is running at http://localhost:${port}`);
  console.log("Send POST requests to /print with printer JSON data to perform direct printing.");
});
