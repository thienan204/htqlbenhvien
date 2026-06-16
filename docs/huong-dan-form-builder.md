# Hướng dẫn sử dụng tính năng Form Builder (Tạo trường dữ liệu động)

Hệ thống đã được nâng cấp với tính năng **Form Builder**. Bây giờ bạn có thể tự do mở rộng thông tin lưu trữ của Thiết bị (và các module khác sau này) mà không cần can thiệp vào mã nguồn.

Dưới đây là cách sử dụng tính năng này:

## 1. Cách thêm một trường dữ liệu mới (Custom Field)

1. Mở form **Thêm mới Thiết bị** (hoặc Sửa thiết bị).
2. Nhấn vào nút **Cấu hình Form** ở góc trên cùng bên phải để bật chế độ chỉnh sửa.
3. Trên thanh công cụ vừa hiện ra, bạn sẽ thấy nút **+ Thêm Trường**. Bấm vào đó.
4. Một bảng phụ sẽ hiện ra, bạn điền các thông tin:
   - **Tên trường (Label):** (Ví dụ: Năm bảo dưỡng, Màu sắc, Số ghế...)
   - **Loại dữ liệu:** Bạn có thể chọn Văn bản, Số, Ngày tháng, Công tắc (Yes/No), hoặc Chọn từ danh sách (Dropdown).
   - Nếu bạn chọn loại **Danh sách chọn**, hãy nhập các tùy chọn cách nhau bằng dấu phẩy (VD: *Đỏ, Xanh, Vàng*).
5. Bấm **Thêm Trường**, trường mới sẽ lập tức xuất hiện dưới cùng của Form.

## 2. Cách sắp xếp và Xóa trường tự tạo

Sau khi trường được tạo ra, bạn vẫn đang ở trong chế độ **Cấu hình Form**:
- **Sắp xếp:** Nhấn giữ biểu tượng kéo thả (nút hình 4 mũi tên chéo) để di chuyển trường đó lên bất kỳ vị trí nào, hoặc bấm nút mũi tên Lên/Xuống.
- **Thay đổi kích thước:** Bấm vào ô số `%` để chỉnh nó chiếm một nửa (50%) hay toàn bộ màn hình (100%).
- **Xóa trường:** Kế bên biểu tượng kéo thả sẽ có một nút **Thùng rác màu đỏ**. Bấm vào để xóa trường nếu bạn không muốn dùng nữa.
  
> [!WARNING]
> Lưu ý: Khi bạn xóa một trường khỏi Form, trường đó sẽ biến mất khỏi giao diện, nhưng dữ liệu lịch sử của thiết bị đó trong cơ sở dữ liệu (Database) không hề bị xóa. Nó vẫn được lưu trữ an toàn trong gói `custom_fields`.

## 3. Dữ liệu được lưu như thế nào?

Mỗi khi bạn ấn **Lưu Hồ sơ**, tất cả những trường "tự tạo" sẽ được hệ thống gom chung vào một cái hộp an toàn tên là `custom_fields` dạng JSON trong cơ sở dữ liệu. Nhờ vậy:
- Bảng cơ sở dữ liệu không bị phình to.
- Hệ thống chạy với hiệu năng tối đa.
- Không lo rác dữ liệu hay xung đột trường.
