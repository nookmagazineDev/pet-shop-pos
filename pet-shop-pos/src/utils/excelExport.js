import * as XLSX from 'xlsx';

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
