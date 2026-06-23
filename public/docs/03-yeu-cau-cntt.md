# Hướng dẫn Quản lý Yêu cầu CNTT

Phân hệ **Quản lý Yêu cầu CNTT** giúp số hóa quy trình báo lỗi và tiếp nhận xử lý sự cố máy tính, mạng, phần mềm từ các khoa phòng trong bệnh viện.

## 1. Dành cho Khoa / Phòng (Người báo sự cố)
- **Tạo yêu cầu:** Người dùng có thể nhấn nút **"Tạo yêu cầu mới"**.
- **Điền thông tin:** Cung cấp chi tiết sự cố (ví dụ: "Máy in khoa Nội không in được", "Phần mềm HIS bị treo").
- **Mức độ ưu tiên:** Có thể chọn mức độ (Thấp, Trung bình, Cao, Khẩn cấp) tùy theo tình hình thực tế.
- **Theo dõi:** Sau khi gửi, yêu cầu sẽ có trạng thái là `Chờ xử lý`. Người báo cáo có thể theo dõi tiến độ giải quyết trực tiếp trên phần mềm.

## 2. Dành cho Tổ CNTT (Người xử lý)
- **Tiếp nhận:** Các kỹ thuật viên CNTT sẽ nhìn thấy danh sách các yêu cầu được đẩy về. 
- **Chuyển trạng thái:** Khi bắt đầu làm, kỹ thuật viên sẽ chuyển trạng thái sang `Đang xử lý`.
- **Phản hồi & Hoàn thành:** Sau khi sửa xong, kỹ thuật viên cập nhật nội dung xử lý (ví dụ: "Đã cài lại driver máy in") và chuyển trạng thái sang `Hoàn thành`.

> [!TIP]
> Việc cập nhật trạng thái liên tục giúp các khoa phòng nắm bắt được tiến độ mà không cần gọi điện thoại hối thúc, giảm tải áp lực cho phòng CNTT.

## 3. Quản lý Máy móc (Bảo trì)
Hệ thống cũng cho phép lưu trữ thông tin về các máy móc thiết bị CNTT (Máy tính, máy in, switch...) giúp dễ dàng truy vết lịch sử hỏng hóc của từng thiết bị.
