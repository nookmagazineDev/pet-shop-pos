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
    "Products": ["Barcode", "Name", "Price", "Quantity", "Location", "LotNumber", "ExpiryDate", "ReceivingDate", "ImageURL"],
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
    // Both now share the same Products data source
    return jsonResponse(readSheetData("Products"));
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
  
  // Deduct Inventory
  const prodSheet = ss.getSheetByName("Products");
  if (prodSheet) {
    const prodData = prodSheet.getDataRange().getValues();
    const cart = payload.cart; // [{Barcode, Name, qty, ...}]
    
    cart.forEach(item => {
      let qtyToDeduct = item.qty;
      const itemBarcode = String(item.Barcode || "").trim();
      const itemName = String(item.Name || item.name || "").trim();
      
      // Look for the product in Products (Start from row 1)
      for (let i = 1; i < prodData.length; i++) {
        if (qtyToDeduct <= 0) break;
        
        const rowBarcode = String(prodData[i][0]).trim();
        const rowName = String(prodData[i][1]).trim();
        
        // Match by Name or Barcode
        if ((itemBarcode && rowBarcode === itemBarcode) || rowName === itemName) {
          let currentStock = parseFloat(prodData[i][3]); // Quantity is in Col 3
          if (!isNaN(currentStock) && currentStock > 0) {
            if (currentStock >= qtyToDeduct) {
              prodSheet.getRange(i + 1, 4).setValue(currentStock - qtyToDeduct);
              prodData[i][3] = currentStock - qtyToDeduct; // update local cache
              qtyToDeduct = 0;
            } else {
              prodSheet.getRange(i + 1, 4).setValue(0);
              prodData[i][3] = 0;
              qtyToDeduct -= currentStock;
            }
          }
        }
      }
    });
  }
  
  return jsonResponse({ success: true, orderId: orderId });
}

function receiveGoods(payload) {
  const sheet = getSpreadsheet().getSheetByName("Products");
  const data = sheet.getDataRange().getValues();
  const searchBarcode = String(payload.barcode || "").trim();
  const searchName = String(payload.productName || "").trim();
  
  // Attempt to update existing first
  for (let i = 1; i < data.length; i++) {
    const rowBarcode = String(data[i][0]).trim();
    const rowName = String(data[i][1]).trim();
    
    // Match by Barcode (if provided) else by Name
    if ((searchBarcode && rowBarcode === searchBarcode) || (!searchBarcode && rowName === searchName)) {
      let currentQty = parseFloat(data[i][3]) || 0;
      let addedQty = parseFloat(payload.quantity) || 0;
      
      sheet.getRange(i + 1, 4).setValue(currentQty + addedQty); // Quantity +=
      sheet.getRange(i + 1, 5).setValue(payload.location || ""); // Location
      sheet.getRange(i + 1, 6).setValue(payload.lotNumber || ""); // LotNumber
      sheet.getRange(i + 1, 7).setValue(payload.expiryDate || ""); // ExpiryDate
      sheet.getRange(i + 1, 8).setValue(payload.receivingDate || ""); // ReceivingDate
      return jsonResponse({ success: true, message: "Updated existing stock" });
    }
  }
  
  // Not found: Append new row
  sheet.appendRow([
    payload.barcode || "",
    payload.productName || "",
    0, // Default Price
    parseFloat(payload.quantity) || 0, // Quantity
    payload.location || "",
    payload.lotNumber || "",
    payload.expiryDate || "",
    payload.receivingDate || "",
    "" // ImageURL
  ]);
  
  return jsonResponse({ success: true, message: "Added new product stock" });
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
