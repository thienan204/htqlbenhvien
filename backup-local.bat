@echo off
chcp 65001 >nul
set PGPASSWORD=root

echo ===================================================
echo SAO LUU DU LIEU DATABASE LOCAL (HTQLBENHVIEN)
echo ===================================================
echo.
echo Dang tien hanh xuat file backup tu may tinh cua ban...

pg_dump -U root -h 127.0.0.1 -p 5432 -d readFileXML -F c -f backup_htqlbenhvien.dump

if %errorlevel% neq 0 (
    echo.
    echo [LOI] Khong the sao luu. Vui long kiem tra xem PostgreSQL dang chay va dung mat khau "root" chua.
    pause
    exit /b
)

echo.
echo ===================================================
echo THANH CONG! File "backup_htqlbenhvien.dump" da duoc tao.
echo.
echo BUOC 1: Ban hay copy file "backup_htqlbenhvien.dump" nay len Server.
echo BUOC 2: Tren Server, mo thu muc HTQLBenhVien va chay 2 dong lenh sau de nap du lieu:
echo.
echo   docker cp backup_htqlbenhvien.dump htqlbenhvien-db:/backup.dump
echo   docker exec htqlbenhvien-db pg_restore -U root -d readFileXML --clean --if-exists /backup.dump
echo ===================================================
echo (Luu y: Thay "readFileXML" bang ten Database thuc te tren Server cua ban neu no khac).
echo.
pause
