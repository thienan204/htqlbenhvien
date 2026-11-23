# HƯỚNG DẪN ĐỐI SOÁT & QUẢN LÝ DANH MỤC DVKT BẮT BUỘC CÓ MÃ MÁY (MẪU 05/DM)

---

## 1. MỤC ĐÍCH & NGHIỆP VỤ BỆNH VIỆN

Theo quy định của Cổng giám định BHYT, một số Dịch vụ Kỹ thuật (DVKT) trong **Mẫu 05/DM** bắt buộc phải có thông tin máy thực hiện (`MA_MAY`) khi đẩy hồ sơ **XML3** (`CHI_TIET_DVKT`). Nếu hồ sơ gửi lên cổng BHYT mà các dịch vụ này để trống trường `MA_MAY`, hệ thống giám định sẽ tự động **từ chối thanh toán (Xuất toán)**.

Hệ thống cung cấp cơ chế:
1. Đồng bộ và lưu trữ danh mục DVKT bắt buộc mã máy trực tiếp từ file Cổng giám định BHYT.
2. Tự động kiểm tra, phát hiện các dịch vụ kỹ thuật nằm trong diện bắt buộc mã máy nhưng hiện đang bị **TẮT** (hoặc bị người dùng gạt nhầm sang trạng thái "Không").
3. Hỗ trợ đối soát trực quan, lọc nhanh và nút **"Bật lại toàn bộ"** chỉ với 1 cú click.
4. Tích hợp Rule kiểm soát XML3 (`1768445961548`) để chặn ngay tại khâu tiền giám định nếu thiếu `MA_MAY`.

---

## 2. TÀI LIỆU API ROUTES

### 2.1. API Lấy dữ liệu đối soát Cổng BHYT
- **Endpoint**: `GET /api/mau05-catalog/audit-bhyt`
- **Mục đích**: Đọc file quy chuẩn BHYT trên máy chủ (`DANH MỤC DVKT BẮT BUỘC CÓ MÃ MÁY...xlsx`), so sánh với các dịch vụ đang có trạng thái `isActive = true` trong cơ sở dữ liệu bệnh viện.
- **Headers**: `Content-Type: application/json`
- **Response thành công (`200 OK`)**:
```json
{
  "success": true,
  "totalExcelCodes": 3471,
  "totalActive": 5561,
  "matchedCount": 3470,
  "discrepantOffCount": 1,
  "discrepantList": [
    {
      "id": "503ea300-e7fd-474a-8991-69352e055451",
      "MA_DICH_VU": "01.0281.1510",
      "TEN_DICH_VU": "Xét nghiệm đường máu mao mạch tại giường (một lần)",
      "DON_GIA": 16000,
      "bat_buoc_co_ma_may": false,
      "nguon_du_lieu": "BENH_VIEN",
      "excelName": "Xét nghiệm đường máu mao mạch tại giường (một lần)"
    }
  ]
}
```
- **Mã lỗi thường gặp**:
  - `500`: Lỗi đọc file máy chủ hoặc lỗi truy vấn CSDL.

---

### 2.2. API Khôi phục / Bật lại yêu cầu mã máy
- **Endpoint**: `POST /api/mau05-catalog/audit-bhyt`
- **Mục đích**: Đối soát file upload hoặc cập nhật trường `bat_buoc_co_ma_may = true` cho các dịch vụ đang bị tắt.
- **Request Body 1: Đối soát file Excel tự tải lên**:
```json
{
  "action": "AUDIT_UPLOAD",
  "fileName": "DANH_MUC_MOI_BHYT.xlsx",
  "rows": [
    { "Mã": "01.0281.1510", "Tên DVKT": "Xét nghiệm đường máu mao mạch..." }
  ]
}
```
- **Request Body 2: Bật lại toàn bộ theo file vừa tải lên**:
```json
{
  "action": "RESTORE_FROM_UPLOAD",
  "ids": ["503ea300-e7fd-474a-8991-69352e055451"]
}
```
- **Request Body 3: Bật lại toàn bộ theo file máy chủ**:
```json
{
  "action": "RESTORE_ALL"
}
```
- **Response thành công (`200 OK`)**:
```json
{
  "success": true,
  "updatedCount": 1,
  "message": "Đã bật lại yêu cầu mã máy cho 1 dịch vụ theo file Excel tải lên."
}
```

---

## 3. HƯỚNG DẪN THAO TÁC CHO NGƯỜI DÙNG (USER GUIDE)

Người dùng có thể chủ động **tải file Excel tải từ Cổng BHYT về** để đối soát ngay trên giao diện:

### Cách 1: Tải file Excel trực tiếp trong cửa sổ Đối soát
1. Bấm nút **"Đối soát Cổng BHYT"** trên thanh công cụ.
2. Tại banner màu vàng cam đầu tiên của cửa sổ, bấm nút: **`[ 📁 Tải file Excel BHYT mới ]`**.
3. Chọn file Excel bạn đã tải từ Cổng giám định BHYT về máy tính của bạn (hệ thống tự động hỗ trợ các cột: `Mã`, `MA_DICH_VU`, `Tên DVKT`, `TEN_DICH_VU`).
4. Hệ thống lập tức đọc file, hiển thị tên file và thống kê:
   - Thẻ 1: **Mã trong file upload** (Tổng số mã DVKT trong file của bạn).
   - Thẻ 2: **Đang dùng tại viện** (Số lượng bản ghi hiệu lực hiện có).
   - Thẻ 3: **Đã chuẩn BHYT** (Số dịch vụ đã được bật mã máy).
   - Thẻ 4: **Lệch chuẩn BHYT** (Số dịch vụ có trong file Excel nhưng viện đang để TẮT).
5. Bạn có thể:
   - Gạt công tắc bật từng dịch vụ trên bảng danh sách.
   - Hoặc bấm nút **"Bật lại toàn bộ (X dịch vụ)"** ở chân cửa sổ để đồng bộ 100% theo file bạn vừa tải lên.
   - Nếu muốn chuyển về file mặc định máy chủ, bấm nút **"Dùng lại file máy chủ"**.

### Cách 2: Bấm trực tiếp vào Thẻ KPI cảnh báo
1. Nhìn lên thẻ KPI **"Bắt buộc có mã máy"** trên cùng trang Mẫu 05.
2. Nếu có dịch vụ nào đang bị tắt nhầm, thẻ sẽ chuyển viền vàng cam kèm nhãn: `⚠️ X DV đang TẮT`.
3. Bấm trực tiếp vào thẻ này, cửa sổ **Đối soát với Cổng BHYT** sẽ tự động mở ra.

### Cách 3: Lọc xem trực tiếp trên bảng chính Mẫu 05
1. Tại bộ lọc **"Tất cả mã máy"**, chọn mục:
   `⚠️ Lệch chuẩn BHYT (X DV đang TẮT)`.
2. Bảng dữ liệu sẽ lập tức lọc ra danh sách đúng các dịch vụ này.
3. Người dùng gạt công tắc cột **"Yêu cầu mã máy"** sang trạng thái **"Bắt buộc"** hoặc tích chọn các ô vuông đầu dòng và bấm nút **"Bắt buộc mã máy (X)"** ở thanh công cụ.

---

## 4. QUY TẮC KIỂM SOÁT XML3 TỰ ĐỘNG

- **Quy tắc**: `1768445961548`
- **Biểu thức logic**: `EXISTS_IN('Mau05_REQUIRE_MACHINE', MA_DICH_VU) && MA_MAY == null`
- **File áp dụng**: XML3 (`CHI_TIET_DVKT`)
- **Trường kiểm tra**: `MA_MAY`
- **Mức độ vi phạm**: `Xuất toán`
- **Hành vi**: Khi người dùng tải file XML lên kiểm tra, nếu gặp bất kỳ dịch vụ nào nằm trong danh mục đã bật cờ `bat_buoc_co_ma_may = true` mà không có mã máy, hệ thống sẽ cảnh báo đỏ và tính vào tổng tiền xuất toán dự kiến.

