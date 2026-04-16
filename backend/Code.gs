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
    "Products": ["ID", "Barcode", "Name", "Price", "ImageURL"],
    "Inventory": ["ProductID", "LotNumber", "Location", "Quantity", "ExpiryDate", "ReceivingDate"],
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

// HANDLE GET REQUESTS (Read Operations)
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === "getProducts") {
    return jsonResponse(readSheetData("Products"));
  } else if (action === "getInventory") {
    return jsonResponse(readSheetData("Inventory"));
  } else if (action === "getShifts") {
    return jsonResponse(readSheetData("Shifts"));
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
    } else if (action === "openShift") {
      return openShift(data.payload);
    } else if (action === "closeShift") {
      return closeShift(data.payload);
    }
    
    return jsonResponse({ error: "Invalid POST action" });
  } catch (error) {
    return jsonResponse({ error: error.toString() });
  }
}

function processCheckout(payload) {
  const sheet = getSpreadsheet().getSheetByName("Transactions");
  const orderId = "ORD-" + new Date().getTime();
  
  sheet.appendRow([
    orderId,
    new Date(),
    payload.totalAmount,
    payload.tax,
    payload.paymentMethod,
    JSON.stringify(payload.cart)
  ]);
  
  // Notice: For a complete system, we would deduct inventory here.
  return jsonResponse({ success: true, orderId: orderId });
}

function receiveGoods(payload) {
  const sheet = getSpreadsheet().getSheetByName("Inventory");
  sheet.appendRow([
    payload.productName, // or ProductID
    payload.lotNumber,
    payload.location,
    payload.quantity,
    payload.expiryDate,
    payload.receivingDate
  ]);
  return jsonResponse({ success: true });
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

// Utility: Read Sheet Data into Array of Objects
function readSheetData(sheetName) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Empty or only headers
  
  const headers = data[0];
  const rows = [];
  
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
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
