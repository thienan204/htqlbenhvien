# HƯỚNG DẪN SỬ DỤNG: GỬI YÊU CẦU HỖ TRỢ KỸ THUẬT CNTT TRỰC TUYẾN
> **Đơn vị phát triển:** Phòng Công nghệ Thông tin - Bệnh viện Đa khoa tỉnh Lạng Sơn  
> **Áp dụng cho:** Toàn thể Cán bộ, Bác sĩ, Điều dưỡng, Kỹ thuật viên các Khoa/Phòng  
> **Đường dẫn truy cập:** `/error-management/it-requests/create`  
> **Trạng thái:** Chạy thử nghiệm toàn viện (Testing & Evaluation)

---

## 1. MỤC ĐÍCH & Ý NGHĨA CHUYỂN ĐỔI SỐ
Nhằm đẩy mạnh công tác chuyển đổi số y tế và nâng cao chất lượng phục vụ công tác khám chữa bệnh, Phòng Công nghệ Thông tin triển khai hệ thống **Gửi yêu cầu hỗ trợ kỹ thuật trực tuyến**, thay thế hoàn toàn các phương thức truyền thống:
* **Không lo bận máy hay trôi tin:** Không còn tình trạng gọi điện thoại trực tiếp bận máy hoặc nhắn tin Zalo cá nhân bị quên, sót việc.
* **Tiếp nhận tức thời:** Ngay khi Khoa/Phòng gửi yêu cầu, hệ thống sẽ tự động thông báo và kỹ thuật viên CNTT sẽ tiếp nhận xử lý ngay.
* **Minh bạch thông tin người nhận việc:** Hệ thống hiển thị rõ ràng **Tên kỹ thuật viên** và **Số điện thoại** trực tiếp của người phụ trách để Khoa/Phòng tiện liên hệ.
* **Tích hợp Chat trực tiếp 2 chiều:** Khoa/Phòng và kỹ thuật viên CNTT có thể nhắn tin, gửi ảnh hiện trường sự cố và trao đổi tiến độ ngay trên từng phiếu.
* **Lưu vết lịch sử:** Mọi yêu cầu đều được cấp mã phiếu, lưu trữ thời gian gửi, thời gian tiếp nhận và thời gian hoàn thành; có chuông thông báo âm thanh tự động khi xử lý xong.

---

## 2. THÔNG TIN ĐĂNG NHẬP MẶC ĐỊNH CHO NHÂN VIÊN
Tất cả cán bộ nhân viên bệnh viện đã được khởi tạo tài khoản đồng bộ từ hệ thống quản lý nhân sự:
* **Tên đăng nhập (Username):** **Số Căn cước công dân (CCCD)** của bạn (12 chữ số).
* **Mật khẩu mặc định (Password):** `123456`

> **Lưu ý quan trọng:** Sau khi đăng nhập thành công lần đầu, đồng chí nên nhấp vào biểu tượng tài khoản ở góc trên bên phải màn hình để đổi mật khẩu cá nhân nhằm đảm bảo an toàn bảo mật.

---

## 3. CÁC BƯỚC THAO TÁC GỬI YÊU CẦU HỖ TRỢ (CHỈ MẤT 30 GIÂY)

### 📌 Cách 1: Tạo nhanh bằng Trợ lý Chat thông minh (Khuyên dùng)
1. Truy cập đường dẫn: `http://[IP_MAY_CHU]:3000/htqlbenhvien/error-management/it-requests/create`.
2. Tại tab **"Tạo Nhanh (Khuyên dùng)"**, hệ thống tự động nhận diện tên bạn và số điện thoại liên hệ từ tài khoản đăng nhập.
3. Nhập câu mô tả sự cố vào ô chat (Ví dụ: *"Máy in khoa Ngoại bị kẹt giấy"*, *"Lỗi không lưu được bệnh án 010203"*...) hoặc nhấp vào các nút gợi ý sự cố phổ biến.
4. *(Tùy chọn)* Dán hoặc tải lên hình ảnh chụp màn hình lỗi (hỗ trợ phím tắt `Ctrl + V` để dán ảnh tức thì).
5. Nhấn nút **"Gửi yêu cầu"**.

### 📌 Cách 2: Gửi sự cố Bệnh án / Phần mềm HIS (Form chi tiết)
1. Chuyển sang tab **"Bệnh án (Phần mềm)"**.
2. Nhập **Mã Bệnh Án (Mã BA)** hoặc **Mã Liên Kết (Mã LK)** cần hỗ trợ.
3. Chọn trạng thái bệnh án (Chưa khóa viện phí, Đã khóa viện phí, Đã thanh toán...).
4. Chọn danh mục lỗi phần mềm cần xử lý và nhập ghi chú chi tiết.
5. Nhấn **"Gửi yêu cầu"**.

### 📌 Cách 3: Gửi sự cố Thiết bị / Phần cứng máy móc
1. Chuyển sang tab **"Thiết bị (Phần cứng)"**.
2. Chọn loại thiết bị gặp sự cố: Máy tính, Màn hình, Máy in, Mạng Internet, Thiết bị y tế kết nối máy tính...
3. Nhập tình trạng lỗi và số phòng / vị trí máy đặt tại khoa.
4. Nhấn **"Gửi yêu cầu"**.

---

## 4. THEO DÕI TIẾN ĐỘ & TRAO ĐỔI VỚI KỸ THUẬT VIÊN CNTT
Ngay sau khi gửi thành công:
1. **Thông tin Kỹ thuật viên tiếp nhận:** Trên màn hình danh sách phiếu (`/error-management/it-requests`), cột *Kỹ thuật phụ trách* sẽ hiển thị rõ **Họ tên** và **Số điện thoại** của nhân viên CNTT nhận việc.
2. **Khung Chat 2 chiều trên phiếu:**
   * Nhấp vào phiếu yêu cầu để mở khung chi tiết.
   * Sử dụng tab **Thảo luận & Chat** để gửi thêm ảnh hiện trường, trao đổi thông tin cụ thể hoặc hỏi tiến độ với kỹ thuật viên.
3. **Chuông thông báo hoàn thành:** Khi kỹ thuật viên xử lý xong và bấm nghiệm thu phiếu, hệ thống sẽ phát âm thanh chuông thông báo và hiện thông báo xác nhận để Khoa/Phòng kiểm tra kết quả.

---

## 5. TIẾP NHẬN Ý KIẾN ĐÓNG GÓP TỪ CÁC KHOA / PHÒNG
Chức năng hiện đang trong giai đoạn **CHẠY THỬ NGHIỆM** toàn bệnh viện. Phòng Công nghệ Thông tin rất mong nhận được những góp ý xây dựng từ các đồng chí Trưởng/Phó khoa, Điều dưỡng trưởng và nhân viên các khoa/phòng:
* Nhấp vào nút **"Góp ý"** (biểu tượng hòm thư góp ý ở góc trên bên phải thanh menu hệ thống).
* Hoặc để lại ý kiến nhận xét trực tiếp trong phần Chat của từng phiếu yêu cầu.

Mọi ý kiến của Khoa/Phòng sẽ là cơ sở quan trọng giúp Phòng CNTT tiếp tục tối ưu giao diện và nâng cao chất lượng phục vụ công tác khám chữa bệnh.

---

## 6. ĐẦU MỐI HỖ TRỢ KHẨN CẤP
Trong các trường hợp sự cố đột xuất ảnh hưởng trực tiếp đến tính mạng bệnh nhân hoặc vận hành cấp cứu khẩn cấp:
* **Phòng Công nghệ Thông tin:** Tầng 4 - Nhà Hành chính, Bệnh viện Đa khoa tỉnh Lạng Sơn.
* **Số máy nội bộ:** Ext 115 (hoặc liên hệ danh bạ trực CNTT bệnh viện).
