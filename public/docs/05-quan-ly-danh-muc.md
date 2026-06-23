# Hướng dẫn Quản lý Danh mục (Mẫu 03, 04)

Hệ thống cung cấp module quản lý danh mục dùng chung (Master Data), cụ thể là danh mục Thuốc (Mẫu 03) và danh mục Vật tư y tế (Mẫu 04) theo chuẩn của Bộ Y tế.

## 1. Mục đích của Danh mục
Danh mục này được dùng làm cơ sở (từ điển) để hệ thống **Rule Engine (Validation XML)** kiểm tra chéo (Cross-check).
Nếu một loại thuốc hay vật tư xuất hiện trong file XML mà không có trong Danh mục này, hệ thống sẽ tự động phát cảnh báo hoặc đánh lỗi xuất toán.

## 2. Tính năng "Xóa toàn bộ"
Để thuận tiện cho việc đồng bộ và cập nhật lại toàn bộ danh mục từ Hệ thống HIS hoặc Cổng Giám định, chúng tôi đã tích hợp nút **"Xóa toàn bộ"** màu đỏ nổi bật ở góc phải màn hình.

> [!WARNING]
> Nút này sẽ **XÓA SẠCH SÀNH SANH** dữ liệu trong bảng danh mục đó. Chỉ sử dụng tính năng này khi bạn chuẩn bị Import/Upload một danh mục mới hoàn toàn để thay thế.

- Để đảm bảo an toàn, hệ thống sẽ yêu cầu bạn xác nhận (Popconfirm) trước khi thực thi lệnh xóa.
- Việc xóa danh mục diễn ra rất nhanh nhờ tối ưu ở tầng Backend (API).

## 3. Upload danh mục mới
Sau khi xóa, bạn có thể thêm lại danh mục thông qua giao diện Import Excel hoặc đồng bộ trực tiếp (nếu có kết nối API với HIS).
