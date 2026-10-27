@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ==============================================================================
:: KỊCH BẢN TỰ ĐỘNG ĐỒNG BỘ BACKUP TỪ MÁY CHỦ BỆNH VIỆN VỀ MÁY TÍNH WINDOWS
:: Hệ thống: HTQL Bệnh viện Đa khoa Lạng Sơn (HTQLBENHVIEN)
:: ==============================================================================

:: --- CẤU HÌNH KẾT NỐI SERVER ---
set "SERVER_IP=192.168.3.98"
set "SERVER_USER=root"
set "REMOTE_BACKUP_DIR=/root/htqlbenhvien/backups"
:: Lưu ý: Nếu trên server bạn đặt ở thư mục khác (vd: /home/admin/htqlbenhvien/backups), hãy sửa lại dòng trên

:: --- CẤU HÌNH THƯ MỤC LƯU TRÊN MÁY TÍNH WINDOWS ---
set "LOCAL_BACKUP_DIR=D:\Backup_BVDKLS"
set "RETENTION_DAYS=30"
set "LOG_FILE=%LOCAL_BACKUP_DIR%\sync_backup.log"

echo ==============================================================================
echo 🕒 [%date% %time%] BẮT ĐẦU ĐỒNG BỘ DỮ LIỆU TỪ SERVER VỀ MÁY TÍNH
echo ==============================================================================
echo 📡 Máy chủ nguồn: %SERVER_USER%@%SERVER_IP%:%REMOTE_BACKUP_DIR%
echo 📁 Thư mục đích:  %LOCAL_BACKUP_DIR%
echo ==============================================================================

:: 1. Tạo thư mục đích nếu chưa có
if not exist "%LOCAL_BACKUP_DIR%" (
    echo 📂 Đang tạo thư mục lưu trữ: %LOCAL_BACKUP_DIR%...
    mkdir "%LOCAL_BACKUP_DIR%"
)

:: Ghi log bắt đầu
echo [%date% %time%] Bắt đầu đồng bộ từ %SERVER_IP% >> "%LOG_FILE%" 2>&1

:: 2. Thực hiện tải các bản backup từ Server về máy tính qua SCP
echo ⏳ Đang đồng bộ các tệp sao lưu mới nhất từ máy chủ...
scp -r -o ConnectTimeout=15 -o StrictHostKeyChecking=no %SERVER_USER%@%SERVER_IP%:"%REMOTE_BACKUP_DIR%/*" "%LOCAL_BACKUP_DIR%\" >> "%LOG_FILE%" 2>&1

if %errorlevel% equ 0 (
    echo ✅ Đồng bộ dữ liệu thành công!
    echo [%date% %time%] Đồng bộ thành công >> "%LOG_FILE%" 2>&1
) else (
    echo ⚠️ Có cảnh báo hoặc lỗi khi đồng bộ. Chi tiết trong: %LOG_FILE%
    echo 💡 Lưu ý: Hãy đảm bảo bạn đã cấu hình SSH Key hoặc kết nối mạng LAN thông suốt tới %SERVER_IP%.
    echo [%date% %time%] Lỗi hoặc cảnh báo khi đồng bộ >> "%LOG_FILE%" 2>&1
)

:: 3. Tự động dọn dẹp các bản backup cũ hơn RETENTION_DAYS trên máy tính Windows
echo 🧹 Đang dọn dẹp các bản sao lưu cũ hơn %RETENTION_DAYS% ngày trên máy tính...
powershell -NoProfile -Command ^
    "$limit = (Get-Date).AddDays(-%RETENTION_DAYS%);" ^
    "Get-ChildItem -Path '%LOCAL_BACKUP_DIR%' -Directory | Where-Object { $_.LastWriteTime -lt $limit } | ForEach-Object { Write-Host 'Đang xóa thư mục cũ:' $_.FullName; Remove-Item -Recurse -Force $_.FullName };" >> "%LOG_FILE%" 2>&1

echo ==============================================================================
echo 🎉 HOÀN TẤT TIẾN TRÌNH ĐỒNG BỘ!
echo 📁 Dữ liệu được lưu an toàn tại: %LOCAL_BACKUP_DIR%
echo 📄 File nhật ký: %LOG_FILE%
echo ==============================================================================

:: Nếu chạy tự động qua Task Scheduler (có truyền cờ /quiet hoặc /nopause) thì thoát luôn, nếu click đúp thì dừng xem kết quả
if /i "%1"=="/quiet" goto end
if /i "%1"=="/nopause" goto end

echo Nhấn phím bất kỳ để đóng cửa sổ...
pause >nul

:end
exit /b
