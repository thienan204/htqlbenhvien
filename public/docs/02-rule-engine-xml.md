# Hướng dẫn Validation XML (Rule Engine)

Module Kiểm tra XML cho phép bạn tự định nghĩa các quy tắc kiểm tra (Rules) để phát hiện các sai sót trong dữ liệu hồ sơ BHYT.

## 1. Cơ chế hoạt động của Rule Engine
Khi bạn thiết lập một quy tắc mới, hệ thống sẽ lưu biểu thức logic của bạn lại. Mỗi khi tải một file XML lên, Rule Engine sẽ duyệt qua từng dòng dữ liệu và chạy biểu thức đó.

### Phân biệt Hoa/Thường
Kể từ phiên bản mới nhất, hệ thống tự động hỗ trợ tính năng **Không phân biệt hoa/thường** (case-insensitive) đối với các thẻ XML. 
Dù phần mềm xuất ra thẻ `<ma_nhom>10</ma_nhom>` hay `<MA_NHOM>10</MA_NHOM>`, hệ thống đều hiểu và map đúng vào dữ liệu.

## 2. Kiểm tra chéo với Danh mục (EXISTS_IN)
Đây là tính năng mạnh mẽ nhất của hệ thống: Cho phép bạn kiểm tra xem mã vật tư hoặc dịch vụ trong file XML có tồn tại trên Database của bệnh viện hay không.

**Ví dụ:** Kiểm tra vật tư (nhóm 10) xem có nằm trong danh mục Mẫu 04 hay không:
- **Trường điều kiện:** `MA_NHOM`
- **Giá trị điều kiện:** `10`
- **Biểu thức logic:** `!EXISTS_IN('Mau04Catalog.MA_VAT_TU', MA_VAT_TU)`

Hệ thống sẽ bóc tách chữ `MA_VAT_TU` trong XML và tra cứu trực tiếp trong bảng `Mau04Catalog` (Database Mẫu 04). Nếu không tìm thấy, hệ thống sẽ đánh lỗi xuất toán.

## 3. Các hàm xử lý chuỗi (String Functions)
Bạn có thể sử dụng các hàm xử lý chuỗi trong biểu thức logic để kiểm tra dữ liệu một cách linh hoạt:

- `ENDS_WITH(TRUONG_DU_LIEU, 'chuoi')`: Kiểm tra trường dữ liệu có kết thúc bằng chuỗi chỉ định hay không.
- `STARTS_WITH(TRUONG_DU_LIEU, 'chuoi')`: Kiểm tra trường dữ liệu có bắt đầu bằng chuỗi chỉ định hay không.
- `CONTAINS(TRUONG_DU_LIEU, 'chuoi')`: Kiểm tra trường dữ liệu có chứa chuỗi chỉ định hay không.

**Ví dụ:** Kiểm tra nếu Mã dịch vụ kết thúc bằng `_GT` thì Phương pháp vô cảm (`PP_VO_CAM`) bắt buộc phải là 2 hoặc 3:
- **Biểu thức logic:** `ENDS_WITH(MA_DICH_VU, '_GT') && PP_VO_CAM != 2 && PP_VO_CAM != 3`

## 4. Cấu hình "Xóa toàn bộ" danh mục
Tại màn hình quản lý Danh mục Mẫu 04, bạn sẽ thấy một nút màu đỏ **Xóa toàn bộ**. 
- Nút này hỗ trợ việc Reset danh mục khi cần cập nhật bảng giá mới nhất.
- Yêu cầu xác nhận (Popconfirm) 2 lần trước khi thực sự xóa dữ liệu.
