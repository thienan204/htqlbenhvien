# Hướng Dẫn Sử Dụng: Thanh Trạng Thái Nhân Viên CNTT (Dạng Accordion Thông Minh)

## 1. Giới thiệu chức năng
Thanh trạng thái nhân sự (**DepartmentStaffStatusStrip**) được thiết kế dưới dạng **Accordion (Ant Design Collapse)** ngay trên trang **Quản lý yêu cầu CNTT** (`/error-management/it-requests`), nằm giữa phần Tiêu đề và Thanh bộ lọc.

### Điểm nổi bật:
- **Thiết kế Accordion đóng/mở linh hoạt**: Giúp tiết kiệm không gian màn hình tối đa.
- **Tóm tắt nhanh ngay trên thanh Header**: Dù đang đóng hay mở, người dùng vẫn nhìn thấy tổng số nhân sự sẵn sàng và tập trung.
- **Ghi nhớ trạng thái (UX)**: Tự động lưu lựa chọn đóng hoặc mở vào `localStorage` (`it_staff_status_expanded`).
- **Phân quyền bảo mật theo vai trò**: Chỉ tài khoản có vai trò `ADMIN`, `CNTT` (hoặc cán bộ thuộc phòng Công nghệ thông tin `KP046`) mới nhìn thấy thanh này. Các tài khoản người dùng của Khoa/Phòng thông thường sẽ hoàn toàn không nhìn thấy, tránh rối mắt và bảo mật thông tin nội bộ.
- **Cơ chế hiển thị Lãnh đạo phòng thông minh**:
  - Kỹ thuật viên: Luôn luôn hiển thị để theo dõi cả khi *Sẵn sàng*, *Tập trung* hay *Tắt nhận việc*.
  - Lãnh đạo phòng (Trưởng phòng, Phó trưởng phòng): **Tự động xuất hiện khi BẬT nhận việc** (`isAvailable = true`) hoặc khi có ticket đang xử lý. Khi Lãnh đạo tắt nhận việc, thẻ của lãnh đạo sẽ tự động ẩn đi để giữ danh sách ca trực gọn gàng.
  - Khi xuất hiện, thẻ của Lãnh đạo có Tag chức vụ trang trọng màu tím (`Trưởng phòng`, `Phó trưởng phòng`) để phân biệt rõ ràng.

---

## 2. Tiêu chí phân loại trạng thái

| Trạng thái | Đèn tín hiệu | Thẻ nhãn (Tag) | Ý nghĩa nghiệp vụ |
| :--- | :---: | :---: | :--- |
| **Sẵn sàng** | 🟢 Xanh lá (Nhấp nháy) | `Sẵn sàng` | Nhân viên/Lãnh đạo đang sẵn sàng được hệ thống tự động gán ticket từ khoa phòng. |
| **Đang tập trung** | 🟡 Vàng cam | `⚡ Tập trung` | Nhân viên đang thực hiện nhiệm vụ chuyên sâu. Rê chuột vào sẽ thấy lý do cụ thể (ví dụ: *"Đi khoa phòng: Huỷ ký số lãnh đạo BA"*). |
| **Tắt nhận việc** | ⚫ Xám | `Tắt nhận việc` | Nhân viên đang tắt nhận việc hoặc tạm nghỉ (Lãnh đạo tắt nhận việc sẽ tự động ẩn). |

---

## 3. Các thao tác người dùng

1. **Đóng / Mở rộng thanh trạng thái**:
   - Nhấp chuột vào bất kỳ vị trí nào trên thanh tiêu đề Accordion để thu gọn hoặc mở rộng danh sách nhân sự.
2. **Xem nhanh tình trạng quân số trực**:
   - Ngay trên thanh Header (kể cả khi đang thu gọn): Xem các badge `🟢 Sẵn sàng`, `🟡 Tập trung`, số lượng lãnh đạo tham gia trực (nếu có).
3. **Lọc nhanh danh sách ticket theo nhân viên / lãnh đạo**:
   - Khi mở rộng, nhấp chuột vào thẻ của bất kỳ ai để lọc nhanh danh sách yêu cầu do người đó thụ lý. Nhấp lại lần nữa để hủy lọc.
4. **Làm mới dữ liệu tức thời**:
   - Bấm vào nút xoay tròn `Làm mới` ở góc phải của thanh Accordion để cập nhật tình trạng mới nhất.
