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
    "Products": ["Barcode", "Name", "Price", "Quantity", "Location", "LotNumber", "ExpiryDate", "ReceivingDate", "ImageURL", "LowStockThreshold"],
    "StoreStock": ["Barcode", "Name", "Quantity", "StoreLocation", "UpdatedAt", "LowStockThreshold"],
    "Transactions": ["OrderID", "Date", "TotalAmount", "Tax", "PaymentMethod", "CartDetails"],
    "Shifts": ["ShiftID", "Status", "OpenTime", "CloseTime", "ExpectedCash", "ActualCash", "Discrepancy"]
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
    p[2], // Price
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
    }
    
    return jsonResponse({ error: "Invalid POST action" });
  } catch (error) {
    return jsonResponse({ error: error.toString() });
  }
}

function processCheckout(payload) {
  const ss = getSpreadsheet();
  const txSheet = ss.getSheetByName("Transactions");
  const orderId = "ORD-" + new Date().getTime();
  
  txSheet.appendRow([
    orderId,
    new Date(),
    payload.totalAmount,
    payload.tax,
    payload.paymentMethod,
    JSON.stringify(payload.cart)
  ]);
  
  // Deduct Inventory — StoreStock first, fallback to Products
  const storeSheet = ss.getSheetByName("StoreStock");
  const prodSheet = ss.getSheetByName("Products");
  const cart = payload.cart;

  cart.forEach(item => {
    let qtyToDeduct = item.qty;
    const itemBarcode = String(item.Barcode || "").trim();
    const itemName = String(item.Name || item.name || "").trim();

    // 1) Try deducting from StoreStock first
    if (storeSheet && qtyToDeduct > 0) {
      const storeData = storeSheet.getDataRange().getValues();
      for (let i = 1; i < storeData.length; i++) {
        if (qtyToDeduct <= 0) break;
        const rowBarcode = String(storeData[i][0]).trim();
        const rowName   = String(storeData[i][1]).trim();
        if ((itemBarcode && rowBarcode === itemBarcode) || rowName === itemName) {
          let storeQty = parseFloat(storeData[i][2]) || 0;
          if (storeQty > 0) {
            const deduct = Math.min(storeQty, qtyToDeduct);
            storeSheet.getRange(i + 1, 3).setValue(storeQty - deduct);
            storeSheet.getRange(i + 1, 5).setValue(new Date());
            qtyToDeduct -= deduct;
          }
        }
      }
    }

    // 2) Fallback: deduct remaining from Products (warehouse)
    if (prodSheet && qtyToDeduct > 0) {
      const prodData = prodSheet.getDataRange().getValues();
      for (let i = 1; i < prodData.length; i++) {
        if (qtyToDeduct <= 0) break;
        const rowBarcode = String(prodData[i][0]).trim();
        const rowName   = String(prodData[i][1]).trim();
        if ((itemBarcode && rowBarcode === itemBarcode) || rowName === itemName) {
          let currentStock = parseFloat(prodData[i][3]) || 0;
          if (currentStock > 0) {
            const deduct = Math.min(currentStock, qtyToDeduct);
            prodSheet.getRange(i + 1, 4).setValue(currentStock - deduct);
            qtyToDeduct -= deduct;
          }
        }
      }
    }
  });
  
  return jsonResponse({ success: true, orderId: orderId });
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
      const currentQty = parseFloat(prodData[i][3]) || 0;
      if (currentQty < moveQty) {
        return jsonResponse({ error: "สต็อกคลังไม่พอ (มี " + currentQty + " ชิ้น แต่ต้องการย้าย " + moveQty + " ชิ้น)" });
      }
      prodSheet.getRange(i + 1, 4).setValue(currentQty - moveQty);
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
  if (!receiptSheet) {
    receiptSheet = ss.insertSheet("InventoryReceipts");
    receiptSheet.appendRow(["Timestamp", "Receipt ID", "Company Name", "Order Number", "Barcode", "Product Name", "Quantity", "Location", "Lot Number", "Expiry Date", "Receiving Date"]);
  }

  const receiptId = "RCV-" + new Date().getTime();
  const timestamp = new Date();

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
      item.receivingDate || ""
    ]);

    let found = false;

    // Attempt to update existing first
    for (let i = 1; i < data.length; i++) {
      const rowBarcode = String(data[i][0]).trim();
      const rowName = String(data[i][1]).trim();
      
      // Match by Barcode (if provided) else by Name
      if ((searchBarcode && rowBarcode === searchBarcode) || (!searchBarcode && rowName === searchName)) {
        let currentQty = parseFloat(data[i][3]) || 0;
        let addedQty = parseFloat(item.quantity) || 0;
        
        sheet.getRange(i + 1, 4).setValue(currentQty + addedQty); // Quantity +=
        if (item.location) sheet.getRange(i + 1, 5).setValue(item.location); // Location
        if (item.lotNumber) sheet.getRange(i + 1, 6).setValue(item.lotNumber); // LotNumber
        if (item.expiryDate) sheet.getRange(i + 1, 7).setValue(item.expiryDate); // ExpiryDate
        if (item.receivingDate) sheet.getRange(i + 1, 8).setValue(item.receivingDate); // ReceivingDate
        
        found = true;
        updatedCount++;
        break;
      }
    }
    
    // Not found: Append new row
    if (!found) {
      sheet.appendRow([
        item.barcode || "",
        item.productName || "",
        0, // Default Price
        parseFloat(item.quantity) || 0, // Quantity
        item.location || "",
        item.lotNumber || "",
        item.expiryDate || "",
        item.receivingDate || "",
        "", // ImageURL
        5 // LowStockThreshold
      ]);
      addedCount++;
    }
  });
  
  return jsonResponse({ success: true, message: `Stock updated: ${updatedCount} items, Added: ${addedCount} items. Logged under Receipt ${receiptId}` });
}

function updateProduct(payload) {
  const sheet = getSpreadsheet().getSheetByName("Products");
  const data = sheet.getDataRange().getValues();
  const searchBarcode = String(payload.barcode || "").trim();
  
  for (let i = 1; i < data.length; i++) {
    const rowBarcode = String(data[i][0]).trim();
    if (rowBarcode === searchBarcode) {
      if (payload.name      !== undefined) sheet.getRange(i + 1, 2).setValue(payload.name);
      if (payload.price     !== undefined) sheet.getRange(i + 1, 3).setValue(parseFloat(payload.price) || 0);
      if (payload.location  !== undefined) sheet.getRange(i + 1, 5).setValue(payload.location);
      if (payload.expiryDate !== undefined) sheet.getRange(i + 1, 7).setValue(payload.expiryDate);
      if (payload.lowStockThreshold !== undefined) sheet.getRange(i + 1, 10).setValue(parseFloat(payload.lowStockThreshold) || 0);
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
      return jsonResponse({ success: true, message: "Payment method updated" });
    }
  }
  return jsonResponse({ error: "Order not found" });
}

// Utility: Read Sheet Data into Array of Objects
function readSheetData(sheetName) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  
  // Auto-fix headers to ensure valid JSON keys
  if (sheetName === "Products") {
    const requiredHeaders = ["Barcode", "Name", "Price", "Quantity", "Location", "LotNumber", "ExpiryDate", "ReceivingDate", "ImageURL", "LowStockThreshold"];
    const currentHeaderRow = sheet.getRange(1, 1, 1, requiredHeaders.length).getValues()[0];
    if (currentHeaderRow[0] !== "Barcode" || currentHeaderRow[3] !== "Quantity" || currentHeaderRow[9] !== "LowStockThreshold") {
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
