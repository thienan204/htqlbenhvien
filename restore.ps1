$c = Get-Content 'src\app\doc-file-excel\page.tsx' -Raw -Encoding UTF8
$c = $c -replace 'currentFile','ptttFile'
$c = $c -replace 'excelDuplicates','ptttDuplicates'
$c = $c -replace 'MENU_DOC_FILE_EXCEL','MENU_PTTT_EXCEL'
$c = $c -replace 'Đọc dữ liệu Excel','Dữ liệu Excel PTTT'
$c = $c -replace 'Tải lên và xem nhanh nội dung file Excel ngay trên trình duyệt','Tải lên và kiểm tra trùng lặp cho file Phẫu thuật - Thủ thuật'
$c = $c -replace 'EXCEL','PTTT'
Set-Content 'src\app\pttt-excel\page.tsx' -Value $c -Encoding UTF8
