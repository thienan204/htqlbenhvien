# HƯỚNG DẪN NGHIỆP VỤ & TÀI LIỆU KỸ THUẬT: CHẤM CÔNG & BỒI DƯỠNG ĐỘC HẠI

Biểu mẫu: **Bảng chấm công hưởng chế độ bồi dưỡng bằng hiện vật (Độc hại)**  
Căn cứ pháp lý: **Thông tư 24/2022/TT-BLĐTBXH** & Quy chế Bệnh viện Đa khoa tỉnh Lạng Sơn.

---

## 1. Mục Đích & Nguyên Tắc Nghiệp Vụ

### 1.1 Mục đích sử dụng
- Theo dõi số ngày làm việc thực tế của nhân viên y tế trong điều kiện lao động có yếu tố nguy hiểm, độc hại tại các khoa/phòng bệnh viện (như Khoa Y học Cổ truyền, Chẩn đoán hình ảnh, Xét nghiệm, Chống nhiễm khuẩn, Giải phẫu bệnh...).
- Tính toán chính xác tổng ngày hưởng và tổng số tiền bồi dưỡng bằng hiện vật quy đổi chi trả hàng tháng cho cán bộ y tế.

### 1.2 Ký hiệu chấm & Quy tắc quy đổi
| Ký hiệu | Ý nghĩa | Thời gian làm việc | Giá trị ngày hưởng quy đổi |
| :---: | :--- | :---: | :---: |
| **`X`** | Làm việc môi trường độc hại từ 4h trở lên/ngày | $\ge$ 4 giờ/ngày | **1.0 ngày** |
| **`I`** | Làm việc môi trường độc hại dưới 4h/ngày | $<$ 4 giờ/ngày | **0.5 ngày** |
| **`-` (Trống)** | Không tiếp xúc / không làm việc độc hại | 0 giờ | **0.0 ngày** |

### 1.3 Các mức bồi dưỡng theo quy định
- **Mức 1**: `13.000` VNĐ / ngày
- **Mức 2**: `20.000` VNĐ / ngày *(Mức áp dụng tiêu chuẩn cho các khoa lâm sàng/cận lâm sàng thông thường)*
- **Mức 3**: `26.000` VNĐ / ngày
- **Mức 4**: `32.000` VNĐ / ngày

### 1.4 Công thức tính
- **Tổng số ngày được hưởng**:
  $$\text{Tổng ngày hưởng} = (\text{Số lượng ô } X \times 1.0) + (\text{Số lượng ô } I \times 0.5)$$
- **Tổng số tiền chi trả (VNĐ)**:
  $$\text{Tổng tiền} = \text{Tổng ngày hưởng} \times \text{Đơn giá mức bồi dưỡng}$$

---

## 2. Thiết Kế Cơ Sở Dữ Liệu (Prisma Model)

Model mới được thêm vào độc lập trong `prisma/schema.prisma`:
```prisma
model StaffHazardRecord {
  id            String   @id @default(cuid())
  staffId       String
  ma_khoa       String   @default("KP046")
  workDate      String   // Định dạng YYYY-MM-DD
  code          String   // 'X' (>= 4h -> 1.0 ngày) | 'I' (< 4h -> 0.5 ngày)
  value         Float    @default(1.0) // 1.0 hoặc 0.5
  hazardLevel   Int      @default(2) // 1: 13k, 2: 20k, 3: 26k, 4: 32k
  allowanceRate Float    @default(20000) // Đơn giá tiền bồi dưỡng/ngày
  note          String?
  createdBy     String?
  updatedBy     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  staff         Staff    @relation(fields: [staffId], references: [id], onDelete: Cascade)

  @@unique([staffId, workDate])
  @@index([ma_khoa, workDate])
}
```

---

## 3. Danh Sách API Routes

### 3.1 Lấy Ma trận Dữ liệu Chấm Độc Hại
- **Endpoint**: `GET /api/staff/attendance/hazard`
- **Query Params**:
  - `monthYear`: Định dạng `YYYY-MM` (Ví dụ: `2026-09`)
  - `ma_khoa`: Mã khoa/phòng (Ví dụ: `KP046`)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "monthYear": "2026-09",
    "ma_khoa": "KP046",
    "departmentName": "Khoa Y học cổ truyền",
    "daysInMonth": 30,
    "daysInfo": [...],
    "staffData": [
      {
        "stt": 1,
        "staffId": "...",
        "ho_ten": "Lê Chí Hướng",
        "chuc_vu": "Trưởng khoa",
        "hazardMap": {
          "2": { "code": "X", "value": 1.0, "allowanceRate": 20000 }
        },
        "summary": {
          "totalDays": 29.0,
          "m2Days": 29.0,
          "totalAmount": 580000
        }
      }
    ],
    "grandSummary": {
      "totalStaff": 14,
      "totalDays": 272.0,
      "m2Days": 272.0,
      "totalAmount": 5440000
    }
  }
  ```

### 3.2 Cập Nhật Từng Ô Chấm Độc Hại
- **Endpoint**: `POST /api/staff/attendance/hazard/update-cell`
- **Request Body**:
  ```json
  {
    "staffId": "cmqwaq3js00enm8g85epf3ouc",
    "date": "2026-09-02",
    "code": "X",
    "ma_khoa": "KP046",
    "hazardLevel": 2,
    "allowanceRate": 20000
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "record": { ... }
  }
  ```

### 3.3 Điền Nhanh từ Bảng Chấm Công
- **Endpoint**: `POST /api/staff/attendance/hazard/sync-attendance`
- **Request Body**:
  ```json
  {
    "monthYear": "2026-09",
    "ma_khoa": "KP046",
    "hazardLevel": 2,
    "allowanceRate": 20000,
    "overwrite": false
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Đã đồng bộ thành công 250 ngày hưởng bồi dưỡng độc hại từ bảng chấm công!",
    "syncedCount": 250
  }
  ```

### 3.4 Xuất Báo Cáo Excel Chuẩn Mẫu
- **Endpoint**: `GET /api/staff/attendance/export-excel?monthYear=2026-09&ma_khoa=KP046&type=CHAM_DOC_HAI`
- **Định dạng file**: File `.xlsx` chuẩn mẫu sheet `ĐỘC HẠI` với tiêu đề, ngày trong tháng, 4 cột định mức, công thức tính tự động và 3 vị trí ký duyệt.

---

## 4. Hướng Dẫn Thao Tác Dành Cho Người Dùng

1. **Truy cập bảng chấm độc hại**:
   - Vào menu **Quản lý Chấm công** $\rightarrow$ Chọn Tab **5. Bảng Chấm Độc Hại (Bồi Dưỡng Hiện Vật)** (hoặc truy cập trực tiếp đường dẫn `/staff/attendance/hazard`).
2. **Chọn Khoa & Tháng/Năm**:
   - Sử dụng bộ lọc tháng và khoa ở đầu trang để chuyển đến kỳ chấm công tương ứng.
3. **Thực hiện chấm công độc hại**:
   - **Cách 1 (Chấm thủ công từng ô)**: Bấm trực tiếp vào ô ngày của cán bộ $\rightarrow$ Menu popup mở ra:
     - Chọn `X`: Làm từ 4h trở lên/ngày (hưởng 1.0 ngày công).
     - Chọn `I`: Làm dưới 4h/ngày (hưởng 0.5 ngày công).
     - Chọn `✕ Xóa`: Bỏ chấm độc hại ngày này.
   - **Cách 2 (Điền nhanh từ Bảng Chấm Công)**:
     - Bấm nút **"⚡ Điền nhanh từ Bảng Chấm Công"** ở góc phải thanh công cụ.
     - Chọn mức phụ cấp (mặc định Mức 2: 20.000 VNĐ) $\rightarrow$ Bấm **"Bắt đầu đồng bộ"**.
     - Hệ thống sẽ tự động quét các ngày cán bộ có đi làm hành chính và điền sẵn dấu `X` (ngày đủ) hoặc `I` (ngày nửa buổi).
4. **Xem tổng hợp & Xuất báo cáo Excel**:
   - Cột tổng số ngày và tổng số tiền của từng cán bộ và dòng tổng cộng toàn khoa sẽ tự động tính toán tức thời theo thời gian thực.
   - Bấm nút **"Xuất Excel Báo Cáo"** ở thanh công cụ chính $\rightarrow$ Chọn **"6. Xuất Bảng Chấm Công Bồi Dưỡng Hiện Vật (Độc Hại)"** để tải về file Excel chuẩn mẫu gửi Phòng Tài chính - Kế toán.

