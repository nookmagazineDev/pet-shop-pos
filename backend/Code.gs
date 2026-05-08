// ==========================================
// PET SHOP MANAGEMENT SYSTEM - BACKEND API
// ==========================================

const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE"; // User will replace this or just use SpreadsheetApp.getActiveSpreadsheet() if bound

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet(); // Ensure the script is bound to the sheet, or use openById.
}

// SETUP FUNCTION: Creates necessary sheets
function setup() {
  const ss = getSpreadsheet();
  const sheets = {
    "Products": ["Barcode", "Name", "VatStatus", "CostPrice", "Price", "WholesalePrice", "ShopeePrice", "LazadaPrice", "LinemanPrice", "Category", "Quantity", "Location", "LotNumber", "ExpiryDate", "ReceivingDate", "ImageURL", "LowStockThreshold", "PackBarcode", "PackMultiplier", "HasExpiry"],
    "StoreStock": ["Barcode", "Name", "Quantity", "StoreLocation", "UpdatedAt", "LowStockThreshold"],
    "StockMovements": ["Date", "Barcode", "Name", "Quantity", "FromLocation", "ToLocation", "MovedBy", "ReferenceNo"],
    "Returns": ["Timestamp", "OrderID", "Barcode", "ProductName", "ReturnQty", "RefundAmount", "ReturnNote", "ActionBy"],
    "Transactions": ["OrderID", "Date", "TotalAmount", "Tax", "PaymentMethod", "CartDetails", "CashReceived", "ChangeReturn", "ShopPlatform", "ReceiptType", "CustomerInfo", "DiscountAmount", "Username", "Status", "CancelNote", "TaxInvoiceNo", "ReceiptNo"],
    "Shifts": ["ShiftID", "Status", "OpenTime", "CloseTime", "ExpectedCash", "ActualCash", "Discrepancy", "DetailsJSON"],
    "Promotions": ["PromoID", "Name", "ConditionType", "ConditionValue1", "ConditionValue2", "DiscountType", "DiscountValue", "Status", "ExpiryDate"],
    "TaxInvoices": ["TaxInvoiceNo", "Date", "OrderID", "CustomerName", "CustomerAddress", "CustomerTaxID", "TotalAmount", "TaxAmount"],
    "Users": ["UserID", "Username", "Password", "DisplayName", "Role", "IsActive", "CreatedAt", "LastLogin"],
    "ActivityLog": ["Timestamp", "User", "Role", "Module", "Action", "ReferenceID", "Details"],
    "Suppliers": ["SupplierID", "Name", "ContactPerson", "Phone", "Email", "Address", "TaxID", "CreatedAt"]
  };

  for (const sheetName in sheets) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(sheets[sheetName]);
      sheet.getRange(1, 1, 1, sheets[sheetName].length).setFontWeight("bold");
    }
  }
}

function logActivity(module, actionType, referenceId, actorObj) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName("ActivityLog");
    if (!sheet) return;
    const actor = actorObj || { displayName: "ระบบ", username: "system", role: "system" };
    const userStr = actor.displayName + " (" + actor.username + ")";
    sheet.appendRow([ new Date(), userStr, actor.role, module, actionType, referenceId || "N/A", "" ]);
  } catch (e) {
    Logger.log("logActivity Error: " + e);
  }
}

// SEED FUNCTION: Inserts 100 mock products for testing. Run once from Apps Script editor.
function seedData() {
  const sheet = getSpreadsheet().getSheetByName("Products");
  if (!sheet) { Logger.log("Products sheet not found. Run setup() first."); return; }

  const locations = ["ชั้น A1", "ชั้น A2", "ชั้น B1", "ชั้น B2", "ชั้น C1", "ชั้น C2", "ตู้เย็น", "โกดัง 1", "โกดัง 2", "หน้าร้าน"];
  const today = new Date();

  const products = [
    // อาหารสุนัข
    ["8851234100001", "Royal Canin อาหารสุนัขพันธุ์เล็ก 1kg", 320, 50],
    ["8851234100002", "Royal Canin อาหารสุนัขพันธุ์กลาง 1kg", 350, 45],
    ["8851234100003", "Pedigree อาหารสุนัขโต รสไก่ 3kg", 280, 60],
    ["8851234100004", "Pedigree อาหารสุนัขลูก รสนม 1kg", 195, 40],
    ["8851234100005", "Eukanuba อาหารสุนัข Adult Small 3kg", 580, 30],
    ["8851234100006", "Hills Science Diet สุนัขพันธุ์เล็ก 2kg", 790, 25],
    ["8851234100007", "Purina Pro Plan สุนัขโต ไก่ & ข้าว 3kg", 680, 35],
    ["8851234100008", "Alpo อาหารเปียก สุนัขโต รสเนื้อ 400g", 45, 120],
    ["8851234100009", "Bowwow อาหารเปียกสุนัข รสไก่ 400g", 39, 100],
    ["8851234100010", "Smartheart อาหารสุนัข รสไก่ 500g", 75, 80],
    // อาหารแมว
    ["8851234100011", "Whiskas อาหารแมวโต ปลาทู 1.2kg", 210, 70],
    ["8851234100012", "Whiskas อาหารเปียก รสทูน่า 85g", 19, 200],
    ["8851234100013", "Royal Canin อาหารแมวในบ้าน 2kg", 490, 40],
    ["8851234100014", "Purina One อาหารแมว ปลาแซลมอน 1.5kg", 375, 35],
    ["8851234100015", "Meow อาหารแมวโต สูตรทูน่า 1kg", 185, 60],
    ["8851234100016", "Hills Perfect Weight แมว 1.5kg", 890, 20],
    ["8851234100017", "Felidae อาหารแมว ไก่ & สมุนไพร 2kg", 650, 28],
    ["8851234100018", "Sheba อาหารเปียกแมว รสปลาหมึก 80g", 25, 150],
    ["8851234100019", "Fancy Feast อาหารเปียกแมว Flaked 85g", 28, 140],
    ["8851234100020", "Me-O อาหารแมวโต สูตรปลา 1.1kg", 165, 55],
    // อาหารสัตว์เลี้ยงอื่น
    ["8851234100021", "อาหารกระต่าย Supreme Pet 1kg", 120, 40],
    ["8851234100022", "อาหารหนูแฮมสเตอร์ Vitakraft 500g", 95, 35],
    ["8851234100023", "อาหารปลาทอง Tetra 100g", 55, 80],
    ["8851234100024", "อาหารนกแก้ว Versele Laga 500g", 145, 30],
    ["8851234100025", "อาหารเต่า Tetra ReptoMin 100g", 85, 25],
    // ขนมและทรีต
    ["8851234100026", "Dentastix ขนมขัดฟันสุนัข 7 ชิ้น", 89, 90],
    ["8851234100027", "Whiskas Temptations ขนมแมว Chicken 85g", 59, 110],
    ["8851234100028", "Milkbone ขนมสุนัข รสผัก 283g", 145, 60],
    ["8851234100029", "Greenies ขนมขัดฟันสุนัขพันธุ์เล็ก 170g", 199, 50],
    ["8851234100030", "Friskies ขนมแมวกรุบกรอบ 60g", 39, 120],
    // ผลิตภัณฑ์สุขภาพ
    ["8851234100031", "วิตามิน Nutri-Vet สุนัข Multi-Vite 60 เม็ด", 320, 40],
    ["8851234100032", "วิตามินรวมแมว Beaphar Kitty's Mix 50g", 285, 35],
    ["8851234100033", "บำรุงข้อ Cosequin DS สุนัข 60 เม็ด", 750, 20],
    ["8851234100034", "น้ำมันปลา Omega-3 สุนัข 100 แคปซูล", 390, 30],
    ["8851234100035", "โปรไบโอติก Fortiflora แมว 30 ซอง", 1200, 15],
    // แชมพูและกรูมมิ่ง
    ["8851234100036", "แชมพูสุนัข Bio Groom 355ml", 180, 50],
    ["8851234100037", "แชมพูแมว Johnsons 200ml", 120, 45],
    ["8851234100038", "ครีมนวด Earthbath สุนัข 236ml", 250, 30],
    ["8851234100039", "สเปรย์ดับกลิ่น Nature's Miracle 500ml", 290, 35],
    ["8851234100040", "น้ำหอมสัตว์เลี้ยง Pet Cologne 100ml", 145, 40],
    ["8851234100041", "หวีแปรงขน FURminator สุนัขขนสั้น", 680, 20],
    ["8851234100042", "กรรไกรตัดขน Andis 7.5 นิ้ว", 890, 15],
    ["8851234100043", "แปรงนวดซิลิโคน PetWell สีฟ้า", 120, 40],
    ["8851234100044", "ผ้าเช็ดตัวสัตว์เลี้ยง Microfiber 60x90cm", 95, 55],
    ["8851234100045", "ที่กรีดเล็บสุนัขขนาดเล็ก", 65, 60],
    // ของเล่น
    ["8851234100046", "ลูกบอลเด้งสุนัข Kong Classic S", 185, 50],
    ["8851234100047", "เชือกดึงสุนัข Cotton Rope 3 ปม", 89, 70],
    ["8851234100048", "ของเล่นไม้ขนนกแมว 30cm", 55, 100],
    ["8851234100049", "ลำโพงหนูสำหรับแมว Catnip 3 ชิ้น", 79, 80],
    ["8851234100050", "ล้อวิ่งหนูแฮมสเตอร์ Silent 20cm", 120, 30],
    ["8851234100051", "บ้านอุโมงค์แมว Felt สีเทา", 350, 25],
    ["8851234100052", "ตุ๊กตาฟองน้ำสุนัข Squeaky 15cm", 65, 60],
    ["8851234100053", "ลูกบอลปริศนาอาหารสุนัข IQ Ball", 145, 40],
    ["8851234100054", "ของเล่นเลเซอร์แมว 3 in 1", 89, 55],
    ["8851234100055", "อุโมงค์ผ้าแมวพับได้ 90cm", 280, 20],
    // ที่นอนและเคนเนล
    ["8851234100056", "ที่นอนสุนัข Memory Foam S 50x40cm", 490, 30],
    ["8851234100057", "ที่นอนแมวขน Sherpa กลม ขนาด 50cm", 320, 35],
    ["8851234100058", "กรงสุนัข Foldable 60x45x50cm", 890, 10],
    ["8851234100059", "บ้านสุนัขพลาสติก S ขนาดกลาง", 1200, 8],
    ["8851234100060", "คอนโดแมว 5 ชั้น Scratcher", 1890, 5],
    // อุปกรณ์เดินทาง
    ["8851234100061", "กระเป๋าหิ้วสัตว์เลี้ยง Canvas S", 450, 20],
    ["8851234100062", "กล่องพลาสติกขนส่งสุนัข M", 680, 12],
    ["8851234100063", "สายจูงสุนัข Flexi Neon 5m", 280, 35],
    ["8851234100064", "ปลอกคอสุนัขหนัง S 1.5cm", 120, 50],
    ["8851234100065", "สายจูงแมว Vest Harness S", 185, 30],
    // สุขาภิบาล
    ["8851234100066", "ทรายแมว Perfect Choice 5L", 89, 80],
    ["8851234100067", "ทรายแมว Makar ถ่วงลมกลิ่น 10L", 145, 60],
    ["8851234100068", "กระบะทรายแมว Closed Top M", 320, 20],
    ["8851234100069", "ถุงเก็บมูลสุนัข BioBag 30 ชิ้น", 59, 100],
    ["8851234100070", "ผ้าเปียกทำความสะอาด Paw Wipes 80 แผ่น", 79, 90],
    ["8851234100071", "สเปรย์ขจัดกลิ่นฉี่ Zero Odor 500ml", 195, 40],
    ["8851234100072", "น้ำยาล้างหู Pet Ear Cleaner 120ml", 145, 35],
    ["8851234100073", "ยาสีฟันสุนัข Virbac CET 70g", 195, 30],
    ["8851234100074", "แผ่นรองฉี่ PetZ Pad 60x90cm แพ็ค 30", 135, 70],
    ["8851234100075", "Tick & Flea Spray ยาฉีดเห็บหมัด 100ml", 185, 40],
    // อุปกรณ์ให้อาหาร
    ["8851234100076", "ชาม Double Feeder สแตนเลส M", 145, 50],
    ["8851234100077", "ที่ให้น้ำอัตโนมัติ PetSafe 1.5L", 589, 20],
    ["8851234100078", "กล่องอาหารอัตโนมัติ Auto Feeder 4L", 1290, 8],
    ["8851234100079", "ชามยางกันลื่น สุนัขพันธุ์เล็ก 300ml", 95, 45],
    ["8851234100080", "ที่ให้น้ำแมว Ceramic Fountain 1.5L", 750, 15],
    // ยาและวัคซีน
    ["8851234100081", "ยาถ่ายพยาธิ Drontal Plus สุนัข 1 เม็ด", 75, 100],
    ["8851234100082", "ยาถ่ายพยาธิแมว Profender Spot-on S", 145, 60],
    ["8851234100083", "ProjectOne ยาป้องกันเห็บหมัด สุนัข S", 280, 50],
    ["8851234100084", "Frontline Plus Spot-on แมว 0.5ml", 195, 55],
    ["8851234100085", "Advocate ยาหยดเห็บหมัด สุนัขพันธุ์กลาง", 320, 40],
    // บริการและอื่น ๆ
    ["8851234100086", "สบู่อาบน้ำสัตว์เลี้ยง Tea Tree 100g", 79, 60],
    ["8851234100087", "ครีมบำรุงผิวหมาป่วย Paw Balm 50ml", 145, 35],
    ["8851234100088", "ที่ฝนเล็บแมว Sisal Scratcher 30cm", 120, 40],
    ["8851234100089", "โซฟากันข่วนแมว Cover Protector", 185, 25],
    ["8851234100090", "กรงนก Parrot Cage 40x40x60cm", 890, 8],
    ["8851234100091", "ตู้ปลา Aquarium 30cm Starter Kit", 550, 10],
    ["8851234100092", "ปั๊มน้ำตู้ปลา Aquael 200L/h", 290, 15],
    ["8851234100093", "หินออกซิเจนตู้ปลา Air Stone 5cm", 35, 80],
    ["8851234100094", "น้ำยาปรับสภาพน้ำตู้ปลา API 118ml", 95, 40],
    ["8851234100095", "ดินปลูกพรรณไม้น้ำ ADA Amazonia 3L", 450, 15],
    ["8851234100096", "ขนมโปรตีนสูงสุนัข Zuke's Mini 170g", 225, 45],
    ["8851234100097", "ก้องฟ้า Catnip ใบสด บรรจุถุง 20g", 45, 90],
    ["8851234100098", "สเปรย์ Feliway Classic 60ml แมว", 580, 20],
    ["8851234100099", "Adaptil Dog Calming Spray 60ml", 620, 18],
    ["8851234100100", "GPS Tracker ติดตามสัตว์เลี้ยง Mini", 1290, 12],
  ];

  const receiveDate = Utilities.formatDate(today, "Asia/Bangkok", "yyyy-MM-dd");
  const expiryDate = Utilities.formatDate(new Date(today.getFullYear() + 2, today.getMonth(), today.getDate()), "Asia/Bangkok", "yyyy-MM-dd");

  const rows = products.map((p, i) => [
    p[0], // Barcode
    p[1], // Name
    "VAT", // VatStatus
    p[2] * 0.7, // CostPrice
    p[2], // Price
    p[2] * 0.9, // WholesalePrice
    p[2] * 1.1, // ShopeePrice
    p[2] * 1.1, // LazadaPrice
    p[2] * 1.15, // LinemanPrice
    "ทั่วไป", // Category
    p[3], // Quantity
    locations[i % locations.length], // Location
    "L-TEST-" + String(i + 1).padStart(3, "0"), // LotNumber
    expiryDate,
    receiveDate,
    "", // ImageURL
    5 // LowStockThreshold
  ]);

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  Logger.log("✅ Seeded " + rows.length + " mock products into Products sheet.");
}



// HANDLE GET REQUESTS (Read Operations)
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === "getProducts") {
    return jsonResponse(readSheetData("Products"));
  } else if (action === "getInventory") {
    return jsonResponse(readSheetData("Products"));
  } else if (action === "getStoreStock") {
    return jsonResponse(readSheetData("StoreStock"));
  } else if (action === "getShifts") {
    return jsonResponse(readSheetData("Shifts"));
  } else if (action === "getTransactions") {
    return jsonResponse(readSheetData("Transactions"));
  } else if (action === "getExpenses") {
    return jsonResponse(readSheetData("Expenses"));
  } else if (action === "getCustomers") {
    return jsonResponse(readSheetData("Customers"));
  } else if (action === "getStockMovements") {
    return jsonResponse(readSheetData("StockMovements"));
  } else if (action === "getPromotions") {
    return jsonResponse(readSheetData("Promotions"));
  } else if (action === "getTaxInvoices") {
    return jsonResponse(readSheetData("TaxInvoices"));
  } else if (action === "getReturns") {
    return jsonResponse(readSheetData("Returns"));
  } else if (action === "getUsers") {
    return jsonResponse(getUsers());
  } else if (action === "getSuppliers") {
    return jsonResponse(readSheetData("Suppliers"));
  }
  
  return jsonResponse({ error: "Invalid action" });
}

// HANDLE POST REQUESTS (Write Operations)
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === "checkout") {
      return processCheckout(data.payload);
    } else if (action === "receiveGoods") {
      return receiveGoods(data.payload);
    } else if (action === "addProduct") {
      return addProduct(data.payload);
    } else if (action === "updateProduct") {
      return updateProduct(data.payload);
    } else if (action === "updateStoreStockDetail") {
      return updateStoreStockDetail(data.payload);
    } else if (action === "moveToStore") {
      return moveToStore(data.payload);
    } else if (action === "openShift") {
      return openShift(data.payload);
    } else if (action === "closeShift") {
      return closeShift(data.payload);
    } else if (action === "updateTransactionPayment") {
      return updateTransactionPayment(data.payload);
    } else if (action === "addExpense") {
      return addExpense(data.payload);
    } else if (action === "saveCustomer") {
      return saveCustomer(data.payload);
    } else if (action === "savePromotion") {
      return savePromotion(data.payload);
    } else if (action === "togglePromotionStatus") {
      return togglePromotionStatus(data.payload);
    } else if (action === "login") {
      return loginUser(data.payload);
    } else if (action === "saveUser") {
      return saveUser(data.payload);
    } else if (action === "toggleUserStatus") {
      return toggleUserStatus(data.payload);
    } else if (action === "deleteUser") {
      return deleteUser(data.payload);
    } else if (action === "cancelTransaction") {
      return cancelTransaction(data.payload);
    } else if (action === "processReturn") {
      return processReturn(data.payload);
    } else if (action === "saveTaxInvoice") {
      return saveTaxInvoice(data.payload);
    } else if (action === "saveSupplier") {
      return saveSupplier(data.payload);
    }
    
    return jsonResponse({ error: "Invalid POST action" });
  } catch (error) {
    return jsonResponse({ error: error.toString() });
  }
}

function processCheckout(payload) {
  const ss = getSpreadsheet();
  const txSheet = ss.getSheetByName("Transactions");
  const orderId = "TX" + new Date().getTime();
  const now = new Date();
  
  let generatedTaxInvoiceNo = null;

  if (payload.receiptType === "ใบกำกับภาษี") {
    let taxSheet = ss.getSheetByName("TaxInvoices");
    if (!taxSheet) {
      taxSheet = ss.insertSheet("TaxInvoices");
      taxSheet.appendRow(["TaxInvoiceNo", "Date", "OrderID", "CustomerName", "CustomerAddress", "CustomerTaxID", "TotalAmount", "TaxAmount"]);
    }
    
    const yearStr = String(now.getFullYear()).slice(-2);
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = "IN" + yearStr + monthStr;
    
    let sequence = 1;
    const taxData = taxSheet.getDataRange().getValues();
    if (taxData.length > 1) {
      for (let i = taxData.length - 1; i >= 1; i--) {
        const lastNo = String(taxData[i][0]).trim();
        if (lastNo.startsWith(prefix)) {
          const lastSeq = parseInt(lastNo.slice(prefix.length), 10);
          if (!isNaN(lastSeq)) {
            sequence = lastSeq + 1;
          }
          break;
        }
      }
    }
    
    generatedTaxInvoiceNo = prefix + String(sequence).padStart(4, '0');
    
    const cInfo = payload.customerInfo || {};
    taxSheet.appendRow([
      generatedTaxInvoiceNo,
      now,
      orderId,
      cInfo.name || cInfo.customerName || "-",
      cInfo.address || cInfo.customerAddress || "-",
      cInfo.taxId || cInfo.customerTaxId || "-",
      payload.totalAmount,
      payload.tax || 0
    ]);
  }

  // Generate ReceiptNo: TX + YY + MM + 4-digit running number
  const rxYY = String(now.getFullYear()).slice(-2);
  const rxMM = String(now.getMonth() + 1).padStart(2, '0');
  const rxPrefix = "TX" + rxYY + rxMM;
  let rxSeq = 1;
  const existingTxData = txSheet.getDataRange().getValues();
  const existingTxHeaders = existingTxData[0];
  const rnoIdx = existingTxHeaders.indexOf("ReceiptNo");
  const colToSearch = rnoIdx >= 0 ? rnoIdx : 16;
  if (existingTxData.length > 1) {
    for (let i = existingTxData.length - 1; i >= 1; i--) {
      const lastNo = String(existingTxData[i][colToSearch] || "").trim();
      if (lastNo.startsWith(rxPrefix)) {
        const lastSeq = parseInt(lastNo.slice(rxPrefix.length), 10);
        if (!isNaN(lastSeq)) { rxSeq = lastSeq + 1; break; }
      }
    }
  }
  const receiptNo = rxPrefix + String(rxSeq).padStart(4, '0');

  txSheet.appendRow([
    orderId,
    now,
    payload.totalAmount,
    payload.tax || 0,
    payload.paymentMethod,
    JSON.stringify(payload.cart),
    payload.cashReceived || 0,
    payload.changeReturn || 0,
    payload.shopPlatform || "Store",
    payload.receiptType || "ใบเสร็จ",
    payload.customerInfo ? JSON.stringify(payload.customerInfo) : "",
    payload.discount || 0,
    payload._actor ? payload._actor.username : "",
    "COMPLETED",
    "",
    generatedTaxInvoiceNo || "",
    receiptNo
  ]);
  
  // Deduct Inventory — always deduct from Products (คลังสินค้า) and also sync StoreStock
  const storeSheet = ss.getSheetByName("StoreStock");
  const prodSheet = ss.getSheetByName("Products");
  const cart = payload.cart;

  cart.forEach(item => {
    const qtyToDeduct = parseFloat(item.qty) || 0;
    const itemBarcode = String(item.Barcode || "").trim();
    const itemName = String(item.Name || item.name || "").trim();

    // 1) Always deduct from Products (คลังสินค้า)
    if (prodSheet && qtyToDeduct > 0) {
      const prodData = prodSheet.getDataRange().getValues();
      for (let i = 1; i < prodData.length; i++) {
        const rowBarcode = String(prodData[i][0]).trim();
        const rowName   = String(prodData[i][1]).trim();
        if ((itemBarcode && rowBarcode === itemBarcode) || (!itemBarcode && rowName === itemName)) {
          const currentStock = parseFloat(prodData[i][10]) || 0;
          prodSheet.getRange(i + 1, 11).setValue(Math.max(0, currentStock - qtyToDeduct));
          break;
        }
      }
    }

    // 2) Also deduct from StoreStock if item exists there
    if (storeSheet && qtyToDeduct > 0) {
      const storeData = storeSheet.getDataRange().getValues();
      for (let i = 1; i < storeData.length; i++) {
        const rowBarcode = String(storeData[i][0]).trim();
        const rowName   = String(storeData[i][1]).trim();
        if ((itemBarcode && rowBarcode === itemBarcode) || (!itemBarcode && rowName === itemName)) {
          const storeQty = parseFloat(storeData[i][2]) || 0;
          if (storeQty > 0) {
            storeSheet.getRange(i + 1, 3).setValue(Math.max(0, storeQty - qtyToDeduct));
            storeSheet.getRange(i + 1, 5).setValue(new Date());
          }
          break;
        }
      }
    }
  });
  
  logActivity("POS/Online", "Checkout", orderId, payload._actor);
  return jsonResponse({ success: true, orderId: orderId, receiptNo: receiptNo, taxInvoiceNo: generatedTaxInvoiceNo });
}

function updateTransactionPayment(payload) {
  const ss = getSpreadsheet();
  const txSheet = ss.getSheetByName("Transactions");
  const orderId = String(payload.orderId || "").trim();
  const newPaymentMethod = String(payload.paymentMethod || "").trim();

  if (!orderId || !newPaymentMethod) return jsonResponse({ error: "Missing orderId or paymentMethod" });

  const data = txSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === orderId) {
      // PaymentMethod is column 5 (index 4)
      txSheet.getRange(i + 1, 5).setValue(newPaymentMethod);
      logActivity("POS/Online", "Confirm Payment", orderId, payload._actor);
      return jsonResponse({ success: true, message: "Payment updated successfully" });
    }
  }
  return jsonResponse({ error: "Order not found" });
}

function cancelTransaction(payload) {
  const ss = getSpreadsheet();
  const txSheet = ss.getSheetByName("Transactions");
  const orderId = String(payload.orderId || "").trim();
  const cancelNote = String(payload.cancelNote || "").trim();
  
  if (!orderId) return jsonResponse({ error: "No Order ID provided" });
  if (!cancelNote) return jsonResponse({ error: "กรุณาระบุหมายเหตุการยกเลิก" });

  const data = txSheet.getDataRange().getValues();
  let foundRow = -1;
  let cartDetailsStr = "";
  let currentStatus = "";

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === orderId) {
      foundRow = i + 1;
      cartDetailsStr = String(data[i][5]);
      currentStatus = String(data[i][13]);
      break;
    }
  }

  if (foundRow === -1) return jsonResponse({ error: "ไม่พบข้อมูลออเดอร์นี้" });
  if (currentStatus === "CANCELLED") return jsonResponse({ error: "ออเดอร์นี้ถูกยกเลิกไปแล้ว" });

  const headers = data[0];
  let statusCol = headers.indexOf("Status") + 1;
  let noteCol = headers.indexOf("CancelNote") + 1;
  
  if (statusCol === 0) statusCol = 14; 
  if (noteCol === 0) noteCol = 15;

  txSheet.getRange(foundRow, statusCol).setValue("CANCELLED");
  txSheet.getRange(foundRow, noteCol).setValue(cancelNote);

  // Return Stock to StoreStock and Products (warehouse)
  let cart = [];
  try { cart = JSON.parse(cartDetailsStr); } catch (e) {}

  if (Array.isArray(cart) && cart.length > 0) {
    const storeSheet = ss.getSheetByName("StoreStock");
    const productsSheet = ss.getSheetByName("Products");
    const stockMoves = ss.getSheetByName("StockMovements");
    const now = new Date();

    const storeData = storeSheet ? storeSheet.getDataRange().getValues() : [];
    const prodData = productsSheet ? productsSheet.getDataRange().getValues() : [];
    const prodHeaders = prodData.length > 0 ? prodData[0] : [];
    const prodQtyCol = prodHeaders.indexOf("Quantity"); // 0-based index

    cart.forEach(item => {
      const itemBarcode = String(item.Barcode || item.barcode || "").trim();
      const itemName = String(item.Name || item.name || "").trim();
      const qtyToReturn = parseFloat(item.qty) || 0;
      if (qtyToReturn <= 0) return;

      // Update StoreStock
      if (storeSheet && storeData.length > 1) {
        for (let s = 1; s < storeData.length; s++) {
          const sBarcode = String(storeData[s][0]).trim();
          const sName = String(storeData[s][1]).trim();
          if ((itemBarcode && sBarcode === itemBarcode) || (!itemBarcode && sName === itemName)) {
            const existingQty = parseFloat(storeData[s][2]) || 0;
            storeSheet.getRange(s + 1, 3).setValue(existingQty + qtyToReturn);
            storeSheet.getRange(s + 1, 5).setValue(now);
            break;
          }
        }
      }

      // Update Products (warehouse)
      if (productsSheet && prodQtyCol >= 0 && prodData.length > 1) {
        for (let p = 1; p < prodData.length; p++) {
          const pBarcode = String(prodData[p][0]).trim();
          const pName = String(prodData[p][1]).trim();
          if ((itemBarcode && pBarcode === itemBarcode) || (!itemBarcode && pName === itemName)) {
            const existingQty = parseFloat(prodData[p][prodQtyCol]) || 0;
            productsSheet.getRange(p + 1, prodQtyCol + 1).setValue(existingQty + qtyToReturn);
            break;
          }
        }
      }

      // Log stock movement
      if (stockMoves) {
        stockMoves.appendRow([now, itemBarcode, itemName, qtyToReturn, "VOID (Order Cancelled)", "คลังสินค้า", payload._actor ? payload._actor.username : "System"]);
      }
    });
  }

  logActivity("POS", "Cancel Order", orderId, payload._actor);
  return jsonResponse({ success: true, message: "ยกเลิกออเดอร์และคืนสต็อกสำเร็จ" });
}

function processReturn(payload) {
  const ss = getSpreadsheet();
  const txSheet = ss.getSheetByName("Transactions");
  const returnSheet = ss.getSheetByName("Returns");
  if (!returnSheet) {
    ss.insertSheet("Returns").appendRow(["Timestamp", "OrderID", "Barcode", "ProductName", "ReturnQty", "RefundAmount", "ReturnNote", "ActionBy"]);
  }

  const orderId = String(payload.orderId || "").trim();
  const cancelNote = String(payload.cancelNote || "").trim();
  const returnedItems = payload.returnedItems || []; // array of {barcode, name, returnQty, price}
  const isFullCancel = payload.isFullCancel === true;

  if (!orderId || returnedItems.length === 0) return jsonResponse({ error: "ข้อมูลการคืนไม่ครบถ้วน" });
  if (!cancelNote) return jsonResponse({ error: "กรุณาระบุหมายเหตุการคืนสินค้า" });

  // 1) Update Transaction Status
  const data = txSheet.getDataRange().getValues();
  let foundRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === orderId) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow !== -1) {
    const headers = data[0];
    let statusCol = headers.indexOf("Status") + 1 || 14;
    let noteCol = headers.indexOf("CancelNote") + 1 || 15;
    const newStatus = isFullCancel ? "CANCELLED" : "PARTIAL_RETURN";
    txSheet.getRange(foundRow, statusCol).setValue(newStatus);
    
    // Concat note if already exists
    const existingNote = String(txSheet.getRange(foundRow, noteCol).getValue() || "").trim();
    const appendedNote = existingNote ? existingNote + " | " + cancelNote : cancelNote;
    txSheet.getRange(foundRow, noteCol).setValue(appendedNote);
  }

  // 2) Process Returns and Restock
  const storeSheet = ss.getSheetByName("StoreStock");
  const stockMoves = ss.getSheetByName("StockMovements");
  const targetReturnsSheet = ss.getSheetByName("Returns");
  const now = new Date();
  const actorName = payload._actor ? payload._actor.username : "System";

  let totalRefund = 0;

  returnedItems.forEach(item => {
    const barcode = String(item.barcode || "").trim();
    const name = String(item.name || "").trim();
    const qty = parseFloat(item.returnQty) || 0;
    const price = parseFloat(item.price) || 0;
    const refundAmt = qty * price;
    
    if (qty > 0) {
      totalRefund += refundAmt;
      
      // Add to Returns sheet
      targetReturnsSheet.appendRow([now, orderId, barcode, name, qty, refundAmt, cancelNote, actorName]);

      // Restock to StoreStock
      if (storeSheet) {
        const storeData = storeSheet.getDataRange().getValues();
        for (let s = 1; s < storeData.length; s++) {
          const sBarcode = String(storeData[s][0]).trim();
          const sName = String(storeData[s][1]).trim();
          if ((barcode && sBarcode === barcode) || (sName === name)) {
            const existingQty = parseFloat(storeData[s][2]) || 0;
            storeSheet.getRange(s + 1, 3).setValue(existingQty + qty);
            storeSheet.getRange(s + 1, 5).setValue(now);
            break;
          }
        }
      }

      // Log to StockMovements
      if (stockMoves) {
        stockMoves.appendRow([now, barcode, name, qty, "Returned (Order " + orderId + ")", "Store", actorName]);
      }
    }
  });

  logActivity("POS", isFullCancel ? "Cancel Order" : "Partial Return", orderId, payload._actor);
  return jsonResponse({ success: true, message: `ทำการคืนสินค้าเรียบร้อยแล้ว (ยอดคืนเงิน ฿${totalRefund})` });
}

function saveTaxInvoice(payload) {
  const ss = getSpreadsheet();
  const txSheet = ss.getSheetByName("Transactions");
  const orderId = String(payload.orderId || "").trim();

  if (!orderId) return jsonResponse({ error: "Missing orderId" });

  let taxSheet = ss.getSheetByName("TaxInvoices");
  if (!taxSheet) {
    taxSheet = ss.insertSheet("TaxInvoices");
    taxSheet.appendRow(["TaxInvoiceNo", "Date", "OrderID", "CustomerName", "CustomerAddress", "CustomerTaxID", "TotalAmount", "TaxAmount"]);
  }

  // Return existing invoice if already issued for this order
  const taxData = taxSheet.getDataRange().getValues();
  for (let i = 1; i < taxData.length; i++) {
    if (String(taxData[i][2]).trim() === orderId) {
      return jsonResponse({ success: true, taxInvoiceNo: String(taxData[i][0]), message: "ออกใบกำกับภาษีนี้ไปแล้ว" });
    }
  }

  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = "IN" + yy + mm;

  let sequence = 1;
  if (taxData.length > 1) {
    for (let i = taxData.length - 1; i >= 1; i--) {
      const lastNo = String(taxData[i][0]).trim().toUpperCase();
      if (lastNo.startsWith(prefix)) {
        const lastSeq = parseInt(lastNo.slice(prefix.length), 10);
        if (!isNaN(lastSeq)) { sequence = lastSeq + 1; break; }
      }
    }
  }

  const taxInvoiceNo = prefix + String(sequence).padStart(4, '0');
  const cInfo = payload.customerInfo || {};

  taxSheet.appendRow([
    taxInvoiceNo,
    now,
    orderId,
    cInfo.name || "-",
    cInfo.address || "-",
    cInfo.taxId || "-",
    parseFloat(payload.totalAmount) || 0,
    parseFloat(payload.taxAmount) || 0
  ]);

  // Update TaxInvoiceNo column in Transactions sheet
  if (txSheet) {
    const txData = txSheet.getDataRange().getValues();
    const txHeaders = txData[0];
    const taxInvCol = txHeaders.indexOf("TaxInvoiceNo") + 1 || 16;
    for (let i = 1; i < txData.length; i++) {
      if (String(txData[i][0]).trim() === orderId) {
        txSheet.getRange(i + 1, taxInvCol).setValue(taxInvoiceNo);
        break;
      }
    }
  }

  logActivity("Accounting", "Issue Tax Invoice", taxInvoiceNo, payload._actor);
  return jsonResponse({ success: true, taxInvoiceNo, message: "ออกใบกำกับภาษีเรียบร้อยแล้ว" });
}

function moveToStore(payload) {
  const ss = getSpreadsheet();
  const prodSheet = ss.getSheetByName("Products");
  const storeSheet = ss.getSheetByName("StoreStock");
  if (!prodSheet || !storeSheet) return jsonResponse({ error: "Required sheets not found. Please run setup() first." });

  const searchBarcode = String(payload.barcode || "").trim();
  const moveQty = parseFloat(payload.quantity) || 0;
  if (moveQty <= 0) return jsonResponse({ error: "Invalid quantity" });

  // 1) Deduct from Products warehouse
  const prodData = prodSheet.getDataRange().getValues();
  let deducted = false;
  for (let i = 1; i < prodData.length; i++) {
    const rowBarcode = String(prodData[i][0]).trim();
    if (rowBarcode === searchBarcode) {
      const currentQty = parseFloat(prodData[i][10]) || 0;
      if (currentQty < moveQty) {
        return jsonResponse({ error: "สต็อกคลังไม่พอ (มี " + currentQty + " ชิ้น แต่ต้องการย้าย " + moveQty + " ชิ้น)" });
      }
      prodSheet.getRange(i + 1, 11).setValue(currentQty - moveQty);
      deducted = true;
      break;
    }
  }
  if (!deducted) return jsonResponse({ error: "ไม่พบสินค้าในคลัง (Barcode: " + searchBarcode + ")" });

  // 2) Add to StoreStock (find existing row or append)
  const storeData = storeSheet.getDataRange().getValues();
  const now = new Date();
  for (let i = 1; i < storeData.length; i++) {
    if (String(storeData[i][0]).trim() === searchBarcode) {
      const existing = parseFloat(storeData[i][2]) || 0;
      storeSheet.getRange(i + 1, 3).setValue(existing + moveQty);
      if (payload.storeLocation) storeSheet.getRange(i + 1, 4).setValue(payload.storeLocation);
      storeSheet.getRange(i + 1, 5).setValue(now);
      
      let moveSheet = ss.getSheetByName("StockMovements");
      if (moveSheet) {
        moveSheet.appendRow([now, searchBarcode, payload.name || "", moveQty, "Warehouse", payload.storeLocation || "Store", "System"]);
      }
      logActivity("Inventory", "Move To Store", searchBarcode, payload._actor);
      return jsonResponse({ success: true, message: "ย้ายสินค้าเข้าหน้าร้านเรียบร้อย" });
    }
  }
  // Not found in store — append new row
  storeSheet.appendRow([
    searchBarcode,
    payload.name || "",
    moveQty,
    payload.storeLocation || "",
    now,
    3 // Default LowStockThreshold for StoreStock
  ]);
  let moveSheet = ss.getSheetByName("StockMovements");
  if (moveSheet) {
    moveSheet.appendRow([now, searchBarcode, payload.name || "", moveQty, "Warehouse", payload.storeLocation || "Store", "System"]);
  }
  logActivity("Inventory", "Move To Store (New)", searchBarcode, payload._actor);
  return jsonResponse({ success: true, message: "ย้ายสินค้าเข้าหน้าร้าน (รายการใหม่) เรียบร้อย" });
}

function receiveGoods(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Products");
  const data = sheet.getDataRange().getValues();
  const items = payload.items || [];
  
  if (items.length === 0) {
    return jsonResponse({ error: "No items provided" });
  }

  // Handle InventoryReceipts sheet tracking
  let receiptSheet = ss.getSheetByName("InventoryReceipts");
  const RECEIPT_HEADERS = ["Timestamp", "Receipt ID", "Company Name", "Order Number", "Barcode", "Product Name", "Quantity", "Location", "Lot Number", "Expiry Date", "Receiving Date", "Unit Cost", "Total Cost", "Order Total Cost", "Supplier Phone", "Supplier Email", "Supplier TaxID"];
  if (!receiptSheet) {
    receiptSheet = ss.insertSheet("InventoryReceipts");
    receiptSheet.appendRow(RECEIPT_HEADERS);
    receiptSheet.getRange(1, 1, 1, RECEIPT_HEADERS.length).setFontWeight("bold");
  } else {
    // Auto-ensure header has all columns
    const existingHeaders = receiptSheet.getRange(1, 1, 1, RECEIPT_HEADERS.length).getValues()[0];
    RECEIPT_HEADERS.forEach((h, i) => {
      if (!existingHeaders[i] || existingHeaders[i] !== h) {
        receiptSheet.getRange(1, i + 1).setValue(h);
      }
    });
  }

  // Auto-save supplier if not exists, and get their info
  let supplierPhone = payload.supplierPhone || "";
  let supplierEmail = payload.supplierEmail || "";
  let supplierTaxId = payload.supplierTaxId || "";
  if (payload.companyName && payload.companyName.trim()) {
    let suppSheet = ss.getSheetByName("Suppliers");
    if (!suppSheet) {
      suppSheet = ss.insertSheet("Suppliers");
      suppSheet.appendRow(["SupplierID", "Name", "ContactPerson", "Phone", "Email", "Address", "TaxID", "CreatedAt"]);
      suppSheet.getRange(1, 1, 1, 8).setFontWeight("bold");
    }
    const suppData = suppSheet.getDataRange().getValues();
    const suppHeaders = suppData[0];
    const nameIdx = suppHeaders.indexOf("Name");
    const phoneIdx = suppHeaders.indexOf("Phone");
    const emailIdx = suppHeaders.indexOf("Email");
    const taxIdx = suppHeaders.indexOf("TaxID");
    let found = false;
    for (let i = 1; i < suppData.length; i++) {
      if (String(suppData[i][nameIdx]).trim().toLowerCase() === payload.companyName.trim().toLowerCase()) {
        // Update info from payload if provided, get existing info
        if (payload.supplierPhone) suppSheet.getRange(i + 1, phoneIdx + 1).setValue(payload.supplierPhone);
        if (payload.supplierEmail) suppSheet.getRange(i + 1, emailIdx + 1).setValue(payload.supplierEmail);
        if (payload.supplierTaxId) suppSheet.getRange(i + 1, taxIdx + 1).setValue(payload.supplierTaxId);
        supplierPhone = payload.supplierPhone || String(suppData[i][phoneIdx] || "");
        supplierEmail = payload.supplierEmail || String(suppData[i][emailIdx] || "");
        supplierTaxId = payload.supplierTaxId || String(suppData[i][taxIdx] || "");
        found = true;
        break;
      }
    }
    if (!found) {
      const newId = "SUP-" + new Date().getTime();
      suppSheet.appendRow([newId, payload.companyName.trim(), payload.contactPerson || "", payload.supplierPhone || "", payload.supplierEmail || "", payload.supplierAddress || "", payload.supplierTaxId || "", new Date().toISOString()]);
    }
  }

  const receiptId = "RCV-" + new Date().getTime();
  const timestamp = new Date();

  // Compute order total cost
  const orderTotalCost = items.reduce((sum, item) => {
    return sum + (parseFloat(item.unitCost || 0) * parseFloat(item.quantity || 0));
  }, 0);

  // Ensure StockMovements has ReferenceNo column
  const moveSheet = ss.getSheetByName("StockMovements");
  if (moveSheet) {
    const moveHeaders = moveSheet.getRange(1, 1, 1, 8).getValues()[0];
    if (!moveHeaders.includes("ReferenceNo")) {
      moveSheet.getRange(1, 8).setValue("ReferenceNo");
      moveSheet.getRange(1, 1, 1, 8).setFontWeight("bold");
    }
  }

  let updatedCount = 0;
  let addedCount = 0;

  items.forEach(item => {
    const searchBarcode = String(item.barcode || "").trim();
    const searchName = String(item.productName || "").trim();
    
    // Log to receipt history
    receiptSheet.appendRow([
      timestamp,
      receiptId,
      payload.companyName || "",
      payload.orderNumber || "",
      searchBarcode,
      searchName,
      parseFloat(item.quantity) || 0,
      item.location || "",
      item.lotNumber || "",
      item.expiryDate || "",
      item.receivingDate || "",
      parseFloat(item.unitCost || 0),
      parseFloat(item.unitCost || 0) * (parseFloat(item.quantity) || 0),
      orderTotalCost,
      supplierPhone,
      supplierEmail,
      supplierTaxId
    ]);

    let found = false;

    // Attempt to update existing first
    for (let i = 1; i < data.length; i++) {
      const rowBarcode = String(data[i][0]).trim();
      const rowName = String(data[i][1]).trim();
      
      // Match by Barcode (if provided) else by Name
      if ((searchBarcode && rowBarcode === searchBarcode) || (!searchBarcode && rowName === searchName)) {
        let currentQty = parseFloat(data[i][10]) || 0;
        let addedQty = parseFloat(item.quantity) || 0;
        let newTotalQty = currentQty + addedQty;

        sheet.getRange(i + 1, 11).setValue(newTotalQty); // Quantity +=
        if (item.vatStatus) sheet.getRange(i + 1, 3).setValue(item.vatStatus);

        // ====== WEIGHTED AVERAGE COST ======
        // newAvgCost = (existingQty * oldCost + addedQty * newUnitCost) / (existingQty + addedQty)
        if (item.unitCost && addedQty > 0) {
          const oldCost = parseFloat(data[i][3]) || 0;
          const newUnitCost = parseFloat(item.unitCost) || 0;
          const avgCost = newTotalQty > 0
            ? ((currentQty * oldCost) + (addedQty * newUnitCost)) / newTotalQty
            : newUnitCost;
          sheet.getRange(i + 1, 4).setValue(Math.round(avgCost * 100) / 100); // CostPrice = weighted avg
        }
        // ===================================

        if (item.category) sheet.getRange(i + 1, 10).setValue(item.category);
        if (item.location) sheet.getRange(i + 1, 12).setValue(item.location); // Location
        if (item.lotNumber) sheet.getRange(i + 1, 13).setValue(item.lotNumber); // LotNumber
        if (item.expiryDate) sheet.getRange(i + 1, 14).setValue(item.expiryDate); // ExpiryDate
        if (item.receivingDate) sheet.getRange(i + 1, 15).setValue(item.receivingDate); // ReceivingDate
        
        // Log to StockMovements
        if (moveSheet) {
          const refNo = receiptId
            + (payload.companyName ? " / " + payload.companyName : "")
            + (payload.orderNumber ? " / PO:" + payload.orderNumber : "");
          const actor = payload._actor ? payload._actor.username : "System";
          moveSheet.appendRow([timestamp, searchBarcode, searchName, parseFloat(item.quantity) || 0, "ซัพพลายเออร์" + (payload.companyName ? ": " + payload.companyName : ""), "คลังสินค้า", actor, refNo]);
        }

        found = true;
        updatedCount++;
        break;
      }
    }

    // Not found: return error
    if (!found) {
      return jsonResponse({ success: false, error: `ไม่พบสินค้าบาร์โค้ด ${item.barcode} ในคลัง กรุณาสร้างสินค้าก่อนรับเข้า` });
    }
  });
  
  let fileUrl = "";
  if (payload.fileData && payload.fileName) {
    try {
      const folder = DriveApp.getRootFolder();
      const dataParts = payload.fileData.split(',');
      let base64Data = dataParts[1];
      let mimeType = dataParts[0].split(':')[1].split(';')[0];
      
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, payload.fileName);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = file.getUrl();
    } catch (e) {
      Logger.log("File Upload Error in receiveGoods: " + e.toString());
      fileUrl = "Upload Failed: " + e.toString();
    }
  }

  // Auto-create expense
  let expSheet = ss.getSheetByName("Expenses");
  if (!expSheet) {
    expSheet = ss.insertSheet("Expenses");
    expSheet.appendRow(["Timestamp", "Date", "Description", "Category", "Amount", "ReceiptFileURL", "ItemsJSON"]);
  } else {
    // Ensure ItemsJSON column exists
    const headers = expSheet.getRange(1, 1, 1, 7).getValues()[0];
    if (headers[6] !== "ItemsJSON") {
      expSheet.getRange(1, 7).setValue("ItemsJSON");
    }
  }
  
  const expenseDesc = "นำเข้าสินค้าจาก: " + (payload.companyName || "ไม่ระบุ") + " (PO: " + (payload.orderNumber || "ไม่ระบุ") + ")";
  expSheet.appendRow([
    timestamp,
    timestamp, // Date
    expenseDesc,
    "ซื้อสินค้าเข้าคลัง", // Category
    orderTotalCost,
    fileUrl,
    JSON.stringify(items) // ItemsJSON
  ]);

  logActivity("Inventory", "Receive Goods", receiptId, payload._actor);
  return jsonResponse({ success: true, message: `Stock updated: ${updatedCount} items, Added: ${addedCount} items. Logged under Receipt ${receiptId}` });
}

function saveSupplier(payload) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName("Suppliers");
  if (!sheet) {
    sheet = ss.insertSheet("Suppliers");
    sheet.appendRow(["SupplierID", "Name", "ContactPerson", "Phone", "Email", "Address", "TaxID", "CreatedAt"]);
    sheet.getRange(1, 1, 1, 8).setFontWeight("bold");
  }
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nameIdx = headers.indexOf("Name");
  const phoneIdx = headers.indexOf("Phone");
  const emailIdx = headers.indexOf("Email");
  const addressIdx = headers.indexOf("Address");
  const taxIdx = headers.indexOf("TaxID");
  const contactIdx = headers.indexOf("ContactPerson");

  const name = String(payload.name || "").trim();
  if (!name) return jsonResponse({ success: false, error: "กรุณาระบุชื่อบริษัท" });

  // Update if exists
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][nameIdx]).trim().toLowerCase() === name.toLowerCase()) {
      if (payload.contactPerson !== undefined) sheet.getRange(i + 1, contactIdx + 1).setValue(payload.contactPerson);
      if (payload.phone !== undefined) sheet.getRange(i + 1, phoneIdx + 1).setValue(payload.phone);
      if (payload.email !== undefined) sheet.getRange(i + 1, emailIdx + 1).setValue(payload.email);
      if (payload.address !== undefined) sheet.getRange(i + 1, addressIdx + 1).setValue(payload.address);
      if (payload.taxId !== undefined) sheet.getRange(i + 1, taxIdx + 1).setValue(payload.taxId);
      return jsonResponse({ success: true, message: "อัปเดตข้อมูลผู้จำหน่ายเรียบร้อย" });
    }
  }

  // New supplier
  const newId = "SUP-" + new Date().getTime();
  sheet.appendRow([newId, name, payload.contactPerson || "", payload.phone || "", payload.email || "", payload.address || "", payload.taxId || "", new Date().toISOString()]);
  return jsonResponse({ success: true, supplierId: newId, message: "บันทึกผู้จำหน่ายใหม่เรียบร้อย" });
}

function addProduct(payload) {
  const sheet = getSpreadsheet().getSheetByName("Products");
  const data = sheet.getDataRange().getValues();
  const searchBarcode = String(payload.barcode || "").trim();
  
  if (!searchBarcode) {
    return jsonResponse({ success: false, error: "บาร์โค้ดไม่สามารถเว้นว่างได้" });
  }

  // Check for duplicate barcode
  for (let i = 1; i < data.length; i++) {
    const rowBarcode = String(data[i][0]).trim();
    if (rowBarcode === searchBarcode) {
      return jsonResponse({ success: false, error: "สินค้านี้มีอยู่ในระบบแล้ว (บาร์โค้ดซ้ำ)" });
    }
  }

  sheet.appendRow([
    payload.barcode || "",
    payload.name || "",
    payload.vatStatus || "VAT",
    parseFloat(payload.costPrice) || 0,
    parseFloat(payload.price) || 0,
    parseFloat(payload.wholesalePrice) || 0,
    parseFloat(payload.shopeePrice) || 0,
    parseFloat(payload.lazadaPrice) || 0,
    parseFloat(payload.linemanPrice) || 0,
    payload.category || "ทั่วไป",
    0, // Quantity (initially 0, will be updated via receive)
    "", // Location
    "", // LotNumber
    "", // ExpiryDate
    "", // ReceivingDate
    "", // ImageURL
    parseFloat(payload.lowStockThreshold) || 5,
    payload.packBarcode || "",
    parseFloat(payload.packMultiplier) || 0,
    payload.hasExpiry !== undefined ? String(payload.hasExpiry).toUpperCase() : "YES"
  ]);

  logActivity("Inventory", "Add Product", payload.barcode, payload._actor);
  return jsonResponse({ success: true, message: `เพิ่มสินค้า ${payload.name} สำเร็จ` });
}

function updateProduct(payload) {
  const sheet = getSpreadsheet().getSheetByName("Products");
  const data = sheet.getDataRange().getValues();
  const searchBarcode = String(payload.barcode || "").trim();
  
  for (let i = 1; i < data.length; i++) {
    const rowBarcode = String(data[i][0]).trim();
    if (rowBarcode === searchBarcode) {
      if (payload.name      !== undefined) sheet.getRange(i + 1, 2).setValue(payload.name);
      if (payload.vatStatus !== undefined) sheet.getRange(i + 1, 3).setValue(payload.vatStatus);
      if (payload.costPrice !== undefined) sheet.getRange(i + 1, 4).setValue(parseFloat(payload.costPrice) || 0);
      if (payload.price     !== undefined) sheet.getRange(i + 1, 5).setValue(parseFloat(payload.price) || 0);
      if (payload.wholesalePrice !== undefined) sheet.getRange(i + 1, 6).setValue(parseFloat(payload.wholesalePrice) || 0);
      if (payload.shopeePrice !== undefined) sheet.getRange(i + 1, 7).setValue(parseFloat(payload.shopeePrice) || 0);
      if (payload.lazadaPrice !== undefined) sheet.getRange(i + 1, 8).setValue(parseFloat(payload.lazadaPrice) || 0);
      if (payload.linemanPrice !== undefined) sheet.getRange(i + 1, 9).setValue(parseFloat(payload.linemanPrice) || 0);
      if (payload.category  !== undefined) sheet.getRange(i + 1, 10).setValue(payload.category);
      if (payload.quantity  !== undefined) sheet.getRange(i + 1, 11).setValue(parseFloat(payload.quantity) || 0);
      if (payload.location  !== undefined) sheet.getRange(i + 1, 12).setValue(payload.location);
      if (payload.expiryDate !== undefined) sheet.getRange(i + 1, 14).setValue(payload.expiryDate);
      if (payload.lowStockThreshold !== undefined) sheet.getRange(i + 1, 17).setValue(parseFloat(payload.lowStockThreshold) || 0);
      if (payload.packBarcode !== undefined) sheet.getRange(i + 1, 18).setValue(payload.packBarcode || "");
      if (payload.packMultiplier !== undefined) sheet.getRange(i + 1, 19).setValue(parseFloat(payload.packMultiplier) || 0);
      if (payload.hasExpiry !== undefined) sheet.getRange(i + 1, 20).setValue(String(payload.hasExpiry).toUpperCase());
      logActivity("Inventory", "Edit Product", searchBarcode, payload._actor);
      return jsonResponse({ success: true, message: "Product updated" });
    }
  }
  return jsonResponse({ error: "Product not found" });
}

function updateStoreStockDetail(payload) {
  const sheet = getSpreadsheet().getSheetByName("StoreStock");
  const data = sheet.getDataRange().getValues();
  const searchBarcode = String(payload.barcode || "").trim();
  
  for (let i = 1; i < data.length; i++) {
    const rowBarcode = String(data[i][0]).trim();
    if (rowBarcode === searchBarcode) {
      if (payload.storeLocation !== undefined) sheet.getRange(i + 1, 4).setValue(payload.storeLocation);
      if (payload.lowStockThreshold !== undefined) sheet.getRange(i + 1, 6).setValue(parseFloat(payload.lowStockThreshold) || 0);
      sheet.getRange(i + 1, 5).setValue(new Date()); // update UpdatedAt
      logActivity("Inventory", "Edit Store Stock", searchBarcode, payload._actor);
      return jsonResponse({ success: true, message: "Store stock details updated" });
    }
  }
  return jsonResponse({ error: "Store stock not found" });
}

function openShift(payload) {
  const sheet = getSpreadsheet().getSheetByName("Shifts");
  const shiftId = "SHF-" + new Date().getTime();
  sheet.appendRow([
    shiftId,
    "OPEN",
    new Date(),
    "",
    payload.initialCash,
    "",
    ""
  ]);
  logActivity("Shift", "Open Shift", shiftId, payload._actor);
  return jsonResponse({ success: true, shiftId: shiftId });
}

function closeShift(payload) {
  const sheet = getSpreadsheet().getSheetByName("Shifts");
  const data = sheet.getDataRange().getValues();
  
  // Find the last OPEN shift
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][1] === "OPEN") {
      sheet.getRange(i + 1, 2).setValue("CLOSED"); // Status
      sheet.getRange(i + 1, 4).setValue(new Date()); // CloseTime
      sheet.getRange(i + 1, 6).setValue(payload.actualCash); // ActualCash
      sheet.getRange(i + 1, 7).setValue(payload.discrepancy); // Discrepancy
      sheet.getRange(i + 1, 8).setValue(payload.shiftDetails ? JSON.stringify(payload.shiftDetails) : "{}"); // DetailsJSON
      logActivity("Shift", "Close Shift", data[i][0] /* ShiftID */, payload._actor);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ error: "No open shift found" });
}


function updateTransactionPayment(payload) {
  const sheet = getSpreadsheet().getSheetByName("Transactions");
  const data = sheet.getDataRange().getValues();
  const searchOrderId = String(payload.orderId || "").trim();
  const newPaymentMethod = String(payload.paymentMethod || "").trim();
  
  if (!searchOrderId || !newPaymentMethod) {
    return jsonResponse({ error: "Missing orderId or paymentMethod" });
  }
  
  for (let i = 1; i < data.length; i++) {
    const rowOrderId = String(data[i][0]).trim();
    if (rowOrderId === searchOrderId) {
      sheet.getRange(i + 1, 5).setValue(newPaymentMethod); // Col 5 = PaymentMethod
      logActivity("Accounting", "Update PaymentMethod", searchOrderId, payload._actor);
      return jsonResponse({ success: true, message: "Payment status updated" });
    }
  }
  
  return jsonResponse({ error: "Transaction not found" });
}

function addExpense(payload) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName("Expenses");
  if (!sheet) {
    sheet = ss.insertSheet("Expenses");
    sheet.appendRow(["Timestamp", "Date", "Description", "Category", "Amount", "ReceiptFileURL"]);
  }

  let fileUrl = "";

  // If there's base64 file data, upload it to Drive
  if (payload.fileData && payload.fileName) {
    try {
      // Changed to root folder to bypass subfolder permission issues
      const folder = DriveApp.getRootFolder();
      
      const dataParts = payload.fileData.split(',');
      let base64Data = dataParts[1];
      let mimeType = dataParts[0].split(':')[1].split(';')[0];
      
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, payload.fileName);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = file.getUrl();
    } catch (e) {
      Logger.log("File Upload Error: " + e.toString());
      fileUrl = "Upload Failed (V3-New): " + e.toString();
    }
  }

  sheet.appendRow([
    new Date(),
    payload.date || new Date(),
    payload.description || "",
    payload.category || "อื่นๆ",
    parseFloat(payload.amount) || 0,
    fileUrl
  ]);

  return jsonResponse({ success: true, message: "Expense added successfully", fileUrl: fileUrl });
}

function saveCustomer(payload) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName("Customers");
  if (!sheet) {
    sheet = ss.insertSheet("Customers");
    sheet.appendRow(["Name", "Phone", "Address", "TaxID", "LastInvoiceID", "LastInvoiceDate", "CreatedAt", "UpdatedAt"]);
  }

  const data = sheet.getDataRange().getValues();
  let found = false;
  
  for (let i = 1; i < data.length; i++) {
    const rowName = String(data[i][0]).trim();
    if (rowName === String(payload.name).trim()) {
      // Update
      if (payload.name) sheet.getRange(i + 1, 1).setValue(payload.name);
      if (payload.phone) sheet.getRange(i + 1, 2).setValue(payload.phone);
      if (payload.address) sheet.getRange(i + 1, 3).setValue(payload.address);
      if (payload.taxId) sheet.getRange(i + 1, 4).setValue(payload.taxId);
      if (payload.lastInvoiceId) sheet.getRange(i + 1, 5).setValue(payload.lastInvoiceId);
      if (payload.lastInvoiceDate) sheet.getRange(i + 1, 6).setValue(payload.lastInvoiceDate);
      sheet.getRange(i + 1, 8).setValue(new Date()); // UpdatedAt
      found = true;
      break;
    }
  }

  if (!found) {
    sheet.appendRow([
      payload.name || "",
      payload.phone || "",
      payload.address || "",
      payload.taxId || "",
      payload.lastInvoiceId || "",
      payload.lastInvoiceDate || "",
      new Date(),
      new Date()
    ]);
  }

  return jsonResponse({ success: true, message: "Customer saved" });
}

function savePromotion(payload) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName("Promotions");
  if (!sheet) return jsonResponse({ error: "Promotions sheet not found. Run setup() first." });
  
  const data = sheet.getDataRange().getValues();
  let found = false;
  
  // If it's a new promotion, payload.promoId might be empty
  const searchPromoId = String(payload.promoId || "").trim();
  const now = new Date();
  
  if (searchPromoId) {
    for (let i = 1; i < data.length; i++) {
      const rowPromoId = String(data[i][0]).trim();
      if (rowPromoId === searchPromoId) {
        // Update
        sheet.getRange(i + 1, 2).setValue(payload.name || "");
        sheet.getRange(i + 1, 3).setValue(payload.conditionType || "");
        sheet.getRange(i + 1, 4).setValue(payload.conditionValue1 || "");
        sheet.getRange(i + 1, 5).setValue(payload.conditionValue2 || "");
        sheet.getRange(i + 1, 6).setValue(payload.discountType || "FIXED");
        sheet.getRange(i + 1, 7).setValue(parseFloat(payload.discountValue) || 0);
        if (payload.status !== undefined) sheet.getRange(i + 1, 8).setValue(payload.status);
        if (payload.expiryDate !== undefined) sheet.getRange(i + 1, 9).setValue(payload.expiryDate);
        found = true;
        break;
      }
    }
  }

  if (!found) {
    // Insert new
    const newPromoId = searchPromoId || ("PRM-" + now.getTime());
    sheet.appendRow([
      newPromoId,
      payload.name || "New Promotion",
      payload.conditionType || "MIN_AMOUNT",
      payload.conditionValue1 || "",
      payload.conditionValue2 || "",
      payload.discountType || "FIXED",
      parseFloat(payload.discountValue) || 0,
      payload.status || "ACTIVE",
      payload.expiryDate || ""
    ]);
  }

  return jsonResponse({ success: true, message: "Promotion saved" });
}

function togglePromotionStatus(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Promotions");
  if (!sheet) return jsonResponse({ error: "Promotions sheet not found" });

  const data = sheet.getDataRange().getValues();
  const searchPromoId = String(payload.promoId || "").trim();
  
  for (let i = 1; i < data.length; i++) {
    const rowPromoId = String(data[i][0]).trim();
    if (rowPromoId === searchPromoId) {
      const currentStatus = String(data[i][7]).trim().toUpperCase();
      const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      sheet.getRange(i + 1, 8).setValue(newStatus);
      return jsonResponse({ success: true, newStatus: newStatus });
    }
  }
  
  return jsonResponse({ error: "Promotion not found" });
}

// Utility: Read Sheet Data into Array of Objects
function readSheetData(sheetName) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  
  // Auto-fix headers to ensure valid JSON keys
  if (sheetName === "Promotions") {
    const requiredHeaders = ["PromoID", "Name", "ConditionType", "ConditionValue1", "ConditionValue2", "DiscountType", "DiscountValue", "Status", "ExpiryDate"];
    const currentHeaderRow = sheet.getRange(1, 1, 1, requiredHeaders.length).getValues()[0];
    if (currentHeaderRow[0] !== "PromoID") {
      sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
      sheet.getRange(1, 1, 1, requiredHeaders.length).setFontWeight("bold");
    }
  } else if (sheetName === "Products") {
    const requiredHeaders = ["Barcode", "Name", "VatStatus", "CostPrice", "Price", "WholesalePrice", "ShopeePrice", "LazadaPrice", "LinemanPrice", "Category", "Quantity", "Location", "LotNumber", "ExpiryDate", "ReceivingDate", "ImageURL", "LowStockThreshold", "PackBarcode", "PackMultiplier", "HasExpiry"];
    const currentHeaderRow = sheet.getRange(1, 1, 1, requiredHeaders.length).getValues()[0];
    if (currentHeaderRow[0] !== "Barcode" || currentHeaderRow[10] !== "Quantity" || currentHeaderRow[16] !== "LowStockThreshold" || currentHeaderRow[17] !== "PackBarcode" || currentHeaderRow[19] !== "HasExpiry") {
      sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
      sheet.getRange(1, 1, 1, requiredHeaders.length).setFontWeight("bold");
    }
  } else if (sheetName === "StoreStock") {
    const requiredHeaders = ["Barcode", "Name", "Quantity", "StoreLocation", "UpdatedAt", "LowStockThreshold"];
    const currentHeaderRow = sheet.getRange(1, 1, 1, requiredHeaders.length).getValues()[0];
    if (currentHeaderRow[0] !== "Barcode" || currentHeaderRow[5] !== "LowStockThreshold") {
      sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
      sheet.getRange(1, 1, 1, requiredHeaders.length).setFontWeight("bold");
    }
  } else if (sheetName === "Transactions") {
    const fullHeaders = ["OrderID", "Date", "TotalAmount", "Tax", "PaymentMethod", "CartDetails", "CashReceived", "ChangeReturn", "ShopPlatform", "ReceiptType", "CustomerInfo", "DiscountAmount", "Username", "Status", "CancelNote", "TaxInvoiceNo", "ReceiptNo"];
    const currentLastCol = Math.max(sheet.getLastColumn(), fullHeaders.length);
    const headerRow = sheet.getRange(1, 1, 1, currentLastCol).getValues()[0];
    const firstCell = String(headerRow[0] || "");
    if (firstCell.indexOf("ORD-") === 0 || /^TX\d{10,}/.test(firstCell)) {
      // No header row — insert full header
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, fullHeaders.length).setValues([fullHeaders]);
      sheet.getRange(1, 1, 1, fullHeaders.length).setFontWeight("bold");
    } else if (firstCell === "OrderID" && !headerRow.includes("Status")) {
      // Header exists but missing Status/CancelNote/TaxInvoiceNo/ReceiptNo — add them
      fullHeaders.forEach((h, i) => {
        if (!headerRow.includes(h)) {
          sheet.getRange(1, i + 1).setValue(h);
        }
      });
      sheet.getRange(1, 1, 1, fullHeaders.length).setFontWeight("bold");
    }
  } else if (sheetName === "Shifts") {
    const requiredHeaders = ["ShiftID", "Status", "OpenTime", "CloseTime", "ExpectedCash", "ActualCash", "Discrepancy", "DetailsJSON"];
    const currentHeaderRow = sheet.getRange(1, 1, 1, requiredHeaders.length).getValues()[0];
    if (currentHeaderRow[0] !== "ShiftID" || currentHeaderRow[7] !== "DetailsJSON") {
      sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
      sheet.getRange(1, 1, 1, requiredHeaders.length).setFontWeight("bold");
    }
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Empty or only headers
  
  const headers = data[0];
  const rows = [];
  
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      // Skip empty header columns
      if (headers[j] && String(headers[j]).trim() !== "") {
        obj[headers[j]] = data[i][j];
      }
    }
    rows.push(obj);
  }
  return rows;
}

// Utility: Return JSON Response with CORS headers
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Run this function manually from the Apps Script IDE to fix "Access Denied" Drive authorization issues.
function authorizeDrive() {
  try {
    const folder = DriveApp.getFolderById("1y8hXWN80EWXavyvrAwYV8bvu_yDKlUi0");
    Logger.log("✅ Authorization Successful! You have access to folder: " + folder.getName());
  } catch (e) {
    Logger.log("❌ Access Error: " + e.toString());
  }
}

// ⚠️ MIGRATION FUNCTION - Run this ONCE to update old Products sheets to use 17 columns
function migrateProductsSheet() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Products");
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log("Sheet empty or headers only.");
    return;
  }
  
  // Check if row 2 (index 1) has old length or if 3rd col (index 2) is numeric price
  const sampleRow = data[1];
  if (sampleRow.length > 10 && typeof sampleRow[2] === "string" && (sampleRow[2] === "VAT" || sampleRow[2] === "NON VAT")) {
    Logger.log("Data is already aligned correctly.");
    return;
  }
  
  const newHeaders = ["Barcode", "Name", "VatStatus", "CostPrice", "Price", "WholesalePrice", "ShopeePrice", "LazadaPrice", "LinemanPrice", "Category", "Quantity", "Location", "LotNumber", "ExpiryDate", "ReceivingDate", "ImageURL", "LowStockThreshold"];
  
  const newRows = [newHeaders];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // If the data was already scrambled by auto-headers, let's try to parse smartly
    // Old format column indexes: 0:Barcode, 1:Name, 2:Price, 3:Quantity, 4:Location, 5:Lot, 6:Exp, 7:Rec, 8:Img, 9:LowStock
    
    let isScrambled = false;
    let oldPrice, oldQty, oldLoc, oldLot, oldExp, oldRec, oldImg, oldLow;
    
    if (row.length === 10 || (row.length >= 10 && typeof row[2] === "number")) {
      // Typical old unstructured row
      oldPrice = parseFloat(row[2]) || 0;
      oldQty = parseFloat(row[3]) || 0;
      oldLoc = row[4];
      oldLot = row[5];
      oldExp = row[6];
      oldRec = row[7];
      oldImg = row[8];
      oldLow = row[9];
    } else {
      // Something weird, fallback to empty defaults, just preserve barcode and name
      oldPrice = 0; oldQty = 0; oldLoc = ""; oldLot = ""; oldExp = ""; oldRec = ""; oldImg = ""; oldLow = 5;
    }

    newRows.push([
      row[0], // Barcode
      row[1], // Name
      "VAT", // VatStatus
      oldPrice * 0.7, // CostPrice mapped from old price
      oldPrice, // Price
      oldPrice * 0.9, // Wholesale
      oldPrice * 1.1, // Shopee
      oldPrice * 1.1, // Lazada
      oldPrice * 1.15, // Lineman
      "ทั่วไป", // Category
      oldQty, // Quantity
      oldLoc, // Location
      oldLot, // LotNumber
      oldExp, // ExpiryDate
      oldRec, // ReceivingDate
      oldImg, // ImageURL
      oldLow // LowStockThreshold
    ]);
  }
  
  sheet.clear();
  sheet.getRange(1, 1, newRows.length, newRows[0].length).setValues(newRows);
  sheet.getRange(1, 1, 1, newRows[0].length).setFontWeight("bold");
  Logger.log("⭐ Migration complete! Converted " + (data.length - 1) + " rows.");
}

// ==========================================
// USER MANAGEMENT FUNCTIONS
// ==========================================

function loginUser(payload) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName("Users");
  if (!sheet) {
    // Auto-create Users sheet with default admin if not present
    sheet = ss.insertSheet("Users");
    sheet.appendRow(["UserID", "Username", "Password", "DisplayName", "Role", "IsActive", "CreatedAt", "LastLogin"]);
    sheet.getRange(1, 1, 1, 8).setFontWeight("bold");
    // Default admin account: admin / admin1234
    sheet.appendRow(["USR-001", "admin", "admin1234", "ผู้ดูแลระบบ", "admin", "TRUE", new Date().toISOString(), ""]);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const usernameIdx = headers.indexOf("Username");
  const passwordIdx = headers.indexOf("Password");
  const roleIdx = headers.indexOf("Role");
  const displayNameIdx = headers.indexOf("DisplayName");
  const isActiveIdx = headers.indexOf("IsActive");
  const userIdIdx = headers.indexOf("UserID");
  const lastLoginIdx = headers.indexOf("LastLogin");

  const username = String(payload.username || "").trim().toLowerCase();
  const password = String(payload.password || "").trim();

  for (let i = 1; i < data.length; i++) {
    const rowUser = String(data[i][usernameIdx] || "").trim().toLowerCase();
    const rowPass = String(data[i][passwordIdx] || "").trim();
    const isActive = String(data[i][isActiveIdx]).toUpperCase() === "TRUE";

    if (rowUser === username && rowPass === password) {
      if (!isActive) {
        return jsonResponse({ success: false, error: "บัญชีนี้ถูกระงับการใช้งาน" });
      }
      // Update last login
      sheet.getRange(i + 1, lastLoginIdx + 1).setValue(new Date().toISOString());
      return jsonResponse({
        success: true,
        user: {
          userId: data[i][userIdIdx],
          username: data[i][usernameIdx],
          displayName: data[i][displayNameIdx],
          role: data[i][roleIdx],
          isActive: isActive
        }
      });
    }
  }
  return jsonResponse({ success: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
}

function getUsers() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Users");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    delete obj["Password"]; // Never return passwords
    return obj;
  });
}

function saveUser(payload) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName("Users");
  if (!sheet) {
    sheet = ss.insertSheet("Users");
    sheet.appendRow(["UserID", "Username", "Password", "DisplayName", "Role", "IsActive", "CreatedAt", "LastLogin"]);
    sheet.getRange(1, 1, 1, 8).setFontWeight("bold");
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const userIdIdx = headers.indexOf("UserID");
  const usernameIdx = headers.indexOf("Username");

  if (payload.userId) {
    // Edit existing user
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][userIdIdx]) === String(payload.userId)) {
        sheet.getRange(i + 1, usernameIdx + 1).setValue(payload.username || data[i][usernameIdx]);
        if (payload.password) {
          sheet.getRange(i + 1, headers.indexOf("Password") + 1).setValue(payload.password);
        }
        sheet.getRange(i + 1, headers.indexOf("DisplayName") + 1).setValue(payload.displayName || data[i][headers.indexOf("DisplayName")]);
        sheet.getRange(i + 1, headers.indexOf("Role") + 1).setValue(payload.role || data[i][headers.indexOf("Role")]);
        return jsonResponse({ success: true });
      }
    }
    return jsonResponse({ success: false, error: "ไม่พบผู้ใช้งาน" });
  } else {
    // Check username unique
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][usernameIdx]).toLowerCase() === String(payload.username || "").toLowerCase()) {
        return jsonResponse({ success: false, error: "มี Username นี้อยู่ในระบบแล้ว" });
      }
    }
    const newId = "USR-" + new Date().getTime();
    sheet.appendRow([newId, payload.username, payload.password, payload.displayName, payload.role, "TRUE", new Date().toISOString(), ""]);
    return jsonResponse({ success: true, userId: newId });
  }
}

function toggleUserStatus(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Users");
  if (!sheet) return jsonResponse({ success: false, error: "No Users sheet" });
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const userIdIdx = headers.indexOf("UserID");
  const isActiveIdx = headers.indexOf("IsActive");
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][userIdIdx]) === String(payload.userId)) {
      const current = String(data[i][isActiveIdx]).toUpperCase() === "TRUE";
      sheet.getRange(i + 1, isActiveIdx + 1).setValue(current ? "FALSE" : "TRUE");
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: "ไม่พบผู้ใช้งาน" });
}

function deleteUser(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Users");
  if (!sheet) return jsonResponse({ success: false });
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const userIdIdx = headers.indexOf("UserID");
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][userIdIdx]) === String(payload.userId)) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: "ไม่พบผู้ใช้งาน" });
}

