# Hướng Dẫn Sử Dụng: Quản Lý Trạng Thái Nhân Sự, Nghỉ Việc & Chuyển Công Tác

## 1. Mục đích
Tài liệu hướng dẫn cán bộ Phòng Tổ Chức Cán Bộ (TCCB) và Ban Giám Đốc quản lý trạng thái công tác của nhân sự bệnh viện (Đang làm việc, Đã nghỉ việc, Chuyển công tác/Thuyên chuyển, Nghỉ hưu, Nghỉ thai sản), đồng thời lưu vết đầy đủ hồ sơ quyết định nghỉ việc hoặc điều động chuyển đơn vị.

---

## 2. Các trạng thái làm việc trong hệ thống
Hệ thống phân định rõ ràng 5 trạng thái công tác:
| Trạng thái | Mã hệ thống | Màu hiển thị (Tag) | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| **Đang làm việc** | `DANG_LAM_VIEC` | 🟢 Xanh lá (Success) | Cán bộ đang công tác bình thường tại khoa/phòng. |
| **Đã nghỉ việc** | `DA_NGHI_VIEC` | 🔴 Đỏ (Error) | Cán bộ đã chấm dứt hợp đồng lao động / thôi việc. |
| **Chuyển công tác** | `THUYEN_CHUYEN` | 🟠 Cam (Warning) | Cán bộ chuyển công tác sang đơn vị, bệnh viện hoặc cơ quan khác ngoài viện. |
| **Nghỉ hưu** | `NGHI_HUU` | 🟣 Tím (Purple) | Cán bộ đã có quyết định nghỉ hưu theo chế độ. |
| **Nghỉ thai sản** | `NGHI_THAI_SAN` | 🌸 Hồng (Magenta) | Cán bộ đang trong thời gian nghỉ chế độ thai sản. |

---

## 3. Các trường dữ liệu bổ sung trong hồ sơ nhân sự
Khi nhân sự chuyển công tác, nghỉ việc hoặc nghỉ hưu, TCCB nhập bổ sung các trường thông tin:
- **`ngay_nghi_viec` (Ngày nghỉ việc / chuyển công tác)**: Ngày chính thức thôi việc hoặc ngày bắt đầu chuyển sang đơn vị mới.
- **`so_qd_nghi_viec` (Số QĐ nghỉ việc / chuyển công tác)**: Số văn bản quyết định (Ví dụ: `125/QĐ-SYT`, `45/QĐ-BVDK`).
- **`ngay_qd_nghi_viec` (Ngày ký QĐ)**: Ngày lãnh đạo ký ban hành quyết định.
- **`don_vi_chuyen_den` (Cơ quan / Đơn vị chuyển đến)**: Tên bệnh viện, sở, trung tâm y tế nơi cán bộ chuyển đến công tác.
- **`ly_do_nghi_viec` (Lý do / Ghi chú)**: Nguyện vọng cá nhân, điều động công tác, hết hạn hợp đồng,...

---

## 4. Hướng dẫn thao tác cho người dùng

### 4.1. Cập nhật trạng thái cho từng nhân sự (Giao diện Form)
1. Truy cập menu **Nhân sự** (`/staff`).
2. Tìm kiếm nhân sự theo Tên hoặc Mã NV.
3. Bấm nút **Sửa** tại dòng nhân sự tương ứng.
4. Tại ô **Trạng thái làm việc**: Chọn trạng thái mong muốn (*Đã nghỉ việc*, *Thuyên chuyển*, hoặc *Nghỉ hưu*).
5. Điền bổ sung các thông tin:
   - *Ngày nghỉ việc / chuyển công tác*
   - *Số QĐ nghỉ việc / chuyển công tác*
   - *Ngày ký QĐ*
   - *Đơn vị chuyển đến* (nếu chuyển công tác)
   - *Lý do / Ghi chú*
6. Bấm nút **Lưu** để hoàn tất.

### 4.2. Tra cứu & Lọc danh sách theo Trạng thái
- Tại thanh công cụ tìm kiếm trên trang `/staff`, sử dụng ô **Lọc Trạng thái**:
  - Chọn **Đang làm việc** để xem toàn bộ cán bộ biên chế hiện diện.
  - Chọn **Đã nghỉ việc** hoặc **Thuyên chuyển** để rà soát danh sách nhân sự đã rời viện.
  - Xóa bộ lọc (dấu x) để xem toàn bộ.

### 4.3. Xem chi tiết hồ sơ nhân sự
- Bấm nút **👁️ Xem** tại dòng nhân sự:
  - Tab **Thông tin chung**: Hiển thị rõ Tag trạng thái làm việc và khối thông tin Quyết định nghỉ việc / Đơn vị chuyển đến (nếu có).
  - Tab **Lịch sử luân chuyển khoa**: Xem lại toàn bộ quá trình công tác qua các khoa phòng nội bộ trong thời gian làm việc tại bệnh viện.

### 4.4. Cập nhật hàng loạt bằng File Excel
1. Bấm nút **Cập nhật hàng loạt** trên thanh công cụ.
2. Tích chọn trường:
   - `trang_thai` (Trạng thái làm việc)
   - `ngay_nghi_viec` (Ngày nghỉ/chuyển đi)
   - `so_qd_nghi_viec` (Số QĐ nghỉ/chuyển)
   - `don_vi_chuyen_den` (Đơn vị chuyển đến)
   - `ly_do_nghi_viec` (Lý do nghỉ/chuyển)
3. Bấm **Tải File Mẫu** -> Điền Mã NV và trạng thái tương ứng.
4. Tải file lên để hệ thống tự động cập nhật hàng loạt.

