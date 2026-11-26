# HƯỚNG DẪN QUẢN LÝ DANH MỤC THIẾT BỊ Y TẾ (MẪU 06/DM)

---

## 1. MỤC ĐÍCH & NGHIỆP VỤ BỆNH VIỆN

Danh mục **Mẫu 06/DM** quản lý toàn bộ trang thiết bị, máy móc y tế đang hoạt động tại Bệnh viện Đa khoa Tỉnh Lạng Sơn. Danh mục này liên kết trực tiếp với trường `MA_MAY` trong file chi tiết dịch vụ kỹ thuật **XML3** (`CHI_TIET_DVKT`), phục vụ công tác tiền giám định và đẩy hồ sơ quyết toán BHYT.

Hệ thống được thiết kế với cơ chế bảo vệ thông tin nội bộ của Bệnh viện:
1. **Cơ chế Import thông minh (Diff & Versioning)**:
   - Khi upload file Excel Mẫu 06 mới, hệ thống tự động so khớp từng trường dữ liệu với bản ghi đang hiệu lực (`isActive = true`).
   - **Nếu có bất kỳ field nào thay đổi**: Hệ thống tự động **disable bản ghi cũ** (`isActive = false` chuyển sang Lịch sử) và **tạo bản ghi mới** (`isActive = true`).
   - **Kế thừa thông minh (Smart Inheritance)**: Nếu file Excel mới để trống hoặc không có cột `TEN_BV` hay `loai_may_code` (ví dụ file tải từ Cổng BHYT không có tên bệnh viện nội bộ), hệ thống tự động **kế thừa giá trị cũ** sang bản ghi mới, tuyệt đối không bị mất thông tin.
   - **Nếu dữ liệu trùng khớp 100%**: Giữ nguyên bản ghi đang dùng, không tạo trùng lặp.
2. **Phân loại máy tương tác trực tiếp (`Select Inline`)**:
   - Cột **"Phân loại (Loại máy)"** tích hợp ô chọn Select tìm kiếm nhanh, cho phép người dùng tự phân loại máy trực tiếp trên từng dòng và lưu tức thì vào CSDL.
3. **Xóa linh hoạt theo Checkbox**:
   - Khi tích chọn ô vuông đầu dòng, nút đỏ hiển thị `Xóa đã chọn (N)` và chỉ xóa đúng các dòng theo checkbox. Khi không chọn dòng nào, nút hiển thị `Xóa toàn bộ` (cho Admin).
4. **Đối soát Cổng - HIS 3 chiều chuyên sâu (Lấy Cổng làm chuẩn)**:
   - Hỗ trợ đối soát ngay cả khi chỉ nạp 1 file Cổng hoặc 1 file HIS với Database viện.
   - Cung cấp 2 bộ lọc nhanh & Thẻ cảnh báo:
     - 🔴 **Có trên HIS mà KHÔNG CÓ trên Cổng BHXH**: Nguy cơ xuất toán 100% khi bác sĩ kê đơn/chỉ định dịch vụ.
     - 🟠 **Có trong DB mà KHÔNG CÓ trên Cổng**: Thiết bị nội bộ viện nhưng chưa khai báo Cổng BHYT.
   - Hỗ trợ xuất Excel riêng danh sách các máy thiếu trên Cổng này.

---

## 2. TÀI LIỆU API ROUTES

### 2.1. API Import & Cập nhật danh mục
- **Endpoint**: `POST /api/mau06-catalog`
- **Method**: `POST`
- **Chức năng 1 - Import Excel**:
  - Nhận mảng JSON từ file Excel (hỗ trợ nhận diện các cột: `Mã máy`, `Tên Thiết Bị`, `Tên Bệnh viện`, `Model`, `Phân loại`, `Loại máy`, `loai_may_code`, `PHAN_LOAI_MAY`...).
  - Kiểm tra thay đổi từng trường: Thay đổi $\rightarrow$ set `isActive: false` bản cũ và tạo bản mới `isActive: true`.
- **Chức năng 2 - Khôi phục Tên Bệnh viện từ lịch sử**:
  - Request Body:
    ```json
    { "action": "RECOVER_HOSPITAL_NAMES" }
    ```

### 2.2. API Cập nhật từng thiết bị / Phân loại máy
- **Endpoint**: `PUT /api/mau06-catalog/[id]`
- **Method**: `PUT`
- **Request Body mẫu khi đổi loại máy**:
  ```json
  {
    "loai_may_code": "MAY_XQUANG"
  }
  ```

### 2.3. API Xóa hàng loạt theo Checkbox
- **Endpoint**: `DELETE /api/mau06-catalog/bulk`
- **Method**: `DELETE`
- **Request Body**:
  ```json
  {
    "ids": ["id-1", "id-2", "id-3"]
  }
  ```

---

## 3. HƯỚNG DẪN THAO TÁC CHO NGƯỜI DÙNG (USER GUIDE)

1. **Tự chọn Phân loại máy trực tiếp trên bảng**:
   - Tại cột **"Phân loại (Loại máy)"**, click vào ô chọn trên dòng máy tương ứng.
   - Gõ từ khóa để tìm kiếm loại máy (Ví dụ: "Điện châm", "X-Quang", "Nội soi"...) và bấm chọn.
   - Hệ thống tự động cập nhật ngay lập tức.

2. **Xóa thiết bị theo Checkbox**:
   - Tích chọn các ô vuông ở đầu các dòng máy cần xóa.
   - Nút đỏ trên thanh công cụ chuyển thành **"Xóa đã chọn (N)"**.
   - Bấm nút và xác nhận để xóa đúng các dòng đã chọn mà không ảnh hưởng tới các thiết bị khác.

3. **Xuất Excel đầy đủ thông tin**:
   - Bấm nút **"Export Dữ liệu"** trên thanh công cụ.
   - Hệ thống sẽ xuất file Excel chứa đầy đủ: STT, Mã máy, Tên thiết bị, Tên bệnh viện, Khoa phòng sử dụng, Phân loại máy (Tên tiếng Việt + Mã), Model, Hãng SX, Năm SD...
   - Nếu bạn có tích chọn checkbox, hệ thống sẽ ưu tiên xuất đúng danh sách đã chọn; nếu không chọn gì sẽ xuất theo danh sách đang lọc.

4. **Đối soát Cổng - HIS & Lọc máy thiếu trên Cổng**:
   - Bấm nút **"Đối soát Cổng - HIS"** màu tím.
   - Nạp file Excel Mẫu 06 tải từ Cổng BHYT và/hoặc file máy từ phần mềm HIS $\rightarrow$ Bấm *"Tiếp tục: Cấu hình Map Cột"*.
   - Khớp cột Mã máy $\rightarrow$ Bấm *"Bắt đầu Đối soát"*.
   - Tại màn hình kết quả:
     - Bấm nút đỏ: **`🔴 Có trên HIS thiếu Cổng`** để xem ngay danh sách các máy có nguy cơ xuất toán 100%.
     - Bấm nút cam: **`🟠 Có trong DB thiếu Cổng`** để xem các máy chưa được duyệt trên Cổng.
     - Bấm **"Xuất Excel Đối soát"** để tải file Excel tổng hợp có sẵn các Sheet báo cáo riêng biệt gửi phòng Vật tư / TBYT.
