# Hướng dẫn Phân tích File Excel & Sắp xếp cột

Hệ thống cung cấp module đọc, đối chiếu và phân tích dữ liệu trực tiếp từ các file Excel kết xuất từ hệ thống HIS/XML, phục vụ cho việc kiểm tra trùng lặp (trùng giường, trùng bác sĩ, trùng thời gian...).

## Tính năng Sắp xếp Cột (Kéo thả)

Tính năng này giúp bạn tùy chỉnh lại thứ tự của các cột dữ liệu theo ý muốn khi xem trên màn hình và khi xuất (Export) ra file Excel mới.

### Cách sử dụng:
1. Tại trang **Danh sách Dữ liệu Trùng lặp**, hãy bấm vào nút **Cấu hình cột** (có biểu tượng bánh răng) ở góc trên bên phải.
2. Một hộp thoại danh sách các cột sẽ hiện ra.
3. Nhấp giữ chuột vào biểu tượng **Menu** ở bên trái tên cột và di chuyển nó lên trên hoặc xuống dưới để thay đổi thứ tự.
4. Ngay khi bạn nhả chuột, bảng dữ liệu ở phía sau sẽ tự động cập nhật lại thứ tự các cột y hệt như bạn vừa sắp xếp.
5. Nhấn **Xuất file Excel này** để tải về máy file Excel có thứ tự các cột được giữ nguyên theo cấu hình bạn vừa tạo.

> [!TIP]
> Việc thay đổi thứ tự cột sẽ không làm thay đổi hay mất đi dữ liệu gốc, cũng không ảnh hưởng đến màu sắc nhóm hay bộ lọc tìm kiếm. Khi bạn tải một file Excel MỚI, thứ tự cột sẽ được đưa về mặc định của file mới đó.

## Phân nhóm theo màu sắc
Các dòng dữ liệu bị phát hiện là "Trùng lặp" (cùng 1 nhóm trùng lặp) sẽ được hệ thống bôi cùng một màu nền. Điều này giúp bạn bằng mắt thường có thể dễ dàng nhận ra các bản ghi liên quan đến nhau. Các bản ghi riêng lẻ không bị trùng sẽ không có màu nền.

## Tìm kiếm thông minh
Thanh tìm kiếm ở trên cùng cho phép bạn lọc dữ liệu trên toàn bộ các cột. 
> [!IMPORTANT]
> Điểm đặc biệt của công cụ tìm kiếm này là: Nếu từ khóa của bạn khớp với 1 bản ghi nằm trong một "Nhóm trùng lặp" (có màu), hệ thống sẽ **hiển thị toàn bộ các bản ghi khác trong cùng nhóm đó** thay vì chỉ hiện 1 bản ghi đơn lẻ. Điều này giúp bạn luôn có cái nhìn toàn cảnh về lỗi trùng.
