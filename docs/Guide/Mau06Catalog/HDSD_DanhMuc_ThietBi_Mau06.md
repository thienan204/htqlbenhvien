# HƯỚNG DẪN QUẢN LÝ DANH MỤC THIẾT BỊ Y TẾ (MẪU 06/DM)

---

## 1. MỤC ĐÍCH & NGHIỆP VỤ BỆNH VIỆN

Danh mục **Mẫu 06/DM** quản lý toàn bộ trang thiết bị, máy móc y tế đang hoạt động tại Bệnh viện Đa khoa Tỉnh Lạng Sơn. Danh mục này liên kết trực tiếp với trường `MA_MAY` trong file chi tiết dịch vụ kỹ thuật **XML3** (`CHI_TIET_DVKT`), phục vụ công tác tiền giám định và đẩy hồ sơ quyết toán BHYT.

Hệ thống được thiết kế với cơ chế bảo vệ thông tin nội bộ của Bệnh viện:
1. **Bảo tồn Tên Bệnh viện (`TEN_BV`) & Phân loại máy**: Khi upload file Excel cập nhật thông số máy móc từ Cổng BHYT (thường không có cột Tên bệnh viện riêng do viện tự đặt), hệ thống tự động **giữ nguyên Tên bệnh viện cũ** của máy đó, tuyệt đối không bị ghi đè thành rỗng/null.
2. **Khôi phục Tên BV từ lịch sử**: Hỗ trợ nút chức năng tự động rà soát và lấy lại Tên bệnh viện từ bản ghi lịch sử gần nhất nếu người dùng từng vô tình bị mất.
3. **Phân bổ Khoa/Phòng**: Hỗ trợ chuyển giao thiết bị cho các khoa lâm sàng/cận lâm sàng sử dụng.

---

## 2. TÀI LIỆU API ROUTES

### 2.1. API Import & Cập nhật danh mục
- **Endpoint**: `POST /api/mau06-catalog`
- **Method**: `POST`
- **Chức năng 1 - Import Excel**:
  - Nhận mảng JSON từ file Excel (hỗ trợ tự động nhận diện cả tiếng Việt có dấu: `Mã máy`, `Tên Thiết Bị`, `Tên Bệnh viện`, `Model`...).
  - Tự động kế thừa `TEN_BV` và `loai_may_code` từ bản ghi active cũ nếu file mới để trống.
  - Nếu toàn bộ thông số kỹ thuật không thay đổi -> Bỏ qua (Skip), không tạo bản ghi rác.
- **Chức năng 2 - Khôi phục Tên Bệnh viện từ lịch sử**:
  - Request Body:
    ```json
    { "action": "RECOVER_HOSPITAL_NAMES" }
    ```
  - Response (`200 OK`):
    ```json
    {
      "success": true,
      "recoveredCount": 5,
      "message": "Đã khôi phục Tên bệnh viện cho 5 thiết bị từ lịch sử."
    }
    ```

### 2.2. API Cập nhật từng thiết bị
- **Endpoint**: `PUT /api/mau06-catalog/[id]`
- **Method**: `PUT`
- **Mục đích**: Cập nhật có chọn lọc (`Selective Update`), chỉ cập nhật các trường được truyền trong body (như bật/tắt `isActive`), không làm mất các thông tin khác của thiết bị.

---

## 3. HƯỚNG DẪN THAO TÁC CHO NGƯỜI DÙNG

1. **Import danh mục máy từ Cổng BHYT**:
   - Bấm nút **"Import Excel"** và chọn file danh mục thiết bị tải từ Cổng BHYT.
   - Hệ thống sẽ tự động cập nhật các thông số kỹ thuật mới, đồng thời bảo toàn 100% Tên bệnh viện của các máy đã có.

2. **Khôi phục Tên Bệnh viện từ lịch sử**:
   - Nếu trước đây bạn từng upload đè file làm trắng cột *Tên Bệnh viện*, chỉ cần bấm nút **"Khôi phục Tên BV"** trên thanh công cụ.
   - Hệ thống sẽ tự động đối chiếu các bản ghi lịch sử cũ và điền lại Tên bệnh viện đầy đủ cho các máy đang dùng.

