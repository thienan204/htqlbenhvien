# HƯỚNG DẪN NGHIỆP VỤ & SỬ DỤNG: KIỂM SOÁT LỖI TIỀN NGÀY GIƯỜNG (XML1 VS XML3)

---

## 1. MỤC ĐÍCH & CĂN CỨ PHÁP LÝ

Tài liệu này hướng dẫn cách cấu hình và sử dụng tính năng **Kiểm soát Tiền ngày giường (XML1 vs XML3)** và **Bảng Đối chiếu Đánh giá Khoa/Phòng** theo quy chuẩn giám định BHYT (Quyết định số 130/QĐ-BYT và Thông tư số 25/2025/TT-BYT).

Tính năng giúp phòng Kế hoạch tổng hợp, Quản lý chất lượng và Tổ Giám định BHYT:
1. Tự động phát hiện các ca kê sai số lượng ngày giường bệnh (kê thừa gây xuất toán hoặc kê thiếu gây thất thu).
2. Tự động kiểm tra đối chiếu chéo giữa thời gian nằm viện thực tế ($T$) và Mã loại hình KCB (`MA_LOAI_KCB` mã `03`, `09`, `04`).
3. Đánh giá mức độ tuân thủ của từng Khoa/Phòng (tỷ lệ đúng, số giường thừa/thiếu, ước tính tiền xuất toán).
4. Xuất file Excel báo cáo chi tiết để gửi giao ban hoặc yêu cầu các khoa phòng điều chỉnh bệnh án trước khi gửi cổng BHXH.

---

## 2. MA TRẬN PHÂN LOẠI 4 NHÓM CA NGÀY GIƯỜNG

Quy ước tính toán mốc thời gian:
- $T = \text{Date}(NGAY\_RA) - \text{Date}(NGAY\_VAO\_NOI\_TRU)$ (tính bằng phút; $240 \text{ phút} = 4 \text{ giờ}$).
- Số ngày lịch chênh lệch (bỏ qua giờ phút):
  $$\text{diffDays} = \text{CalendarDay}(NGAY\_RA) - \text{CalendarDay}(NGAY\_VAO\_NOI\_TRU)$$

| Nhóm ca | Mốc thời gian nằm viện | Điều kiện XML1 (`KET_QUA_DTRI` & `MA_LOAI_RV`) | Công thức Giường chuẩn ($S_{\text{chuẩn}}$) | Lưu ý nghiệp vụ & Mã KCB |
| :---: | :--- | :--- | :---: | :--- |
| **Nhóm 1** | **Nằm $\le 4$ giờ** ($T \le 240$ phút, dù cùng ngày hay qua đêm) | Mọi trường hợp | **$S_{\text{chuẩn}} = 0$** | - Không được thu tiền ngày giường.<br/>- Nếu hồ sơ đang để mã `03` (Nội trú), hệ thống sẽ cảnh báo chuyển sang mã `09` (Điều trị nội trú dưới 04 giờ). |
| **Nhóm 2** | **Vào & Ra CÙNG 1 NGÀY ($> 4$ giờ)** ($\text{diffDays} = 0$ VÀ $T > 240$ phút) | Mọi trường hợp (kể cả ra viện, tử vong hay chuyển tuyến) | **$S_{\text{chuẩn}} = 1$** | - Tính tròn **1 ngày giường** (chặn lỗi trừ ra 0 hoặc cộng nhầm thành 2). |
| **Nhóm 3** | **Nằm KHÁC NGÀY - Ra viện thông thường** ($\text{diffDays} > 0$ VÀ $T > 240$ phút) | `KET_QUA_DTRI` $\in \{1, 2, 3, 4, 7\}$<br/>**VÀ**<br/>`MA_LOAI_RV` $\in \{1, 3, 4, 5\}$ | **$S_{\text{chuẩn}} = \text{diffDays}$**<br/>*(Ngày ra - Ngày vào)* | - Ngày vào tính giường, ngày ra không tính giường. |
| **Nhóm 4** | **Nằm KHÁC NGÀY - Tử vong, Nặng xin về, Chuyển tuyến** ($\text{diffDays} > 0$ VÀ $T > 240$ phút) | `KET_QUA_DTRI` $\in \{5, 6, 8\}$<br/>**HOẶC**<br/>`MA_LOAI_RV` $= 2$ | **$S_{\text{chuẩn}} = \text{diffDays} + 1$**<br/>*(Ngày ra - Ngày vào + 1)* | - Trường hợp tử vong, nặng xin về hoặc chuyển tuyến chuyên môn: **Được tính thêm 1 ngày giường ra viện**. |

---

## 3. CẤU HÌNH ĐỘNG MÃ NHÓM (`MA_NHOM`) TRONG TRANG `/rules`

Hệ thống **không cố định mã nhóm trong code** mà đọc trực tiếp từ cấu hình quy tắc tại `/rules`:
- **Đường dẫn**: `/rules` (Cấu hình Quy tắc Validation XML).
- **Tên quy tắc**: `Kiểm soát Tiền ngày giường (XML1 vs XML3)`.
- **Mã quy tắc (ID)**: `rule_bed_days_audit`.
- **Trường điều kiện**: `MA_NHOM`.
- **Giá trị điều kiện**: `14,15` (hoặc bạn có thể bổ sung thêm `13,14,15` tùy quy ước danh mục của bệnh viện).

> [!TIP]
> Bạn có thể bấm công tắc **Trạng thái (Active)** để Bật hoặc Tắt quy tắc này bất cứ lúc nào. Khi tắt, hệ thống sẽ bỏ qua kiểm tra lỗi này khi chạy duyệt hồ sơ.

---

## 4. HƯỚNG DẪN THAO TÁC TẠI TRANG `/xml-checker`

### 4.1. Nhận diện lỗi khi duyệt hồ sơ
1. Khi tải lên tệp XML / ZIP hoặc bấm **"Chạy lại kiểm tra"**, các hồ sơ bị lệch ngày giường sẽ hiển thị lỗi vi phạm màu đỏ:
   - `[Lệch ngày giường] Kê THỪA X ngày giường -> Xuất toán BHYT`.
   - `[Lệch ngày giường] Kê THIẾU Y ngày giường -> Thất thu`.
   - `[Lệch ngày giường] Ca điều trị nội trú dưới 4 giờ -> Cần dùng mã 09`.
2. Khi bấm xem chi tiết hồ sơ bệnh nhân, ở mục lỗi vi phạm sẽ có nút bấm **"Mở bảng đối soát ngày giường"** để xem phân tích chi tiết.

### 4.2. Sử dụng Modal Đối chiếu Khoa/Phòng
1. Trên thanh công cụ chính của trang `/xml-checker`, bấm vào nút **"Kiểm soát Ngày giường"** (có huy hiệu Badge đếm số ca phát hiện lỗi).
2. Hộp thoại **"Bảng Đối chiếu Kiểm soát Tiền ngày giường & Đánh giá Khoa/Phòng"** mở ra:
   - **Hàng KPI Cards**: Xem nhanh tổng ca kiểm tra, ca đúng, ca thừa giường (xuất toán), ca thiếu giường và tổng tiền nguy cơ bị xuất toán.
   - **Thanh Bộ lọc**:
     - Lọc theo `MA_LOAI_KCB` (03 Nội trú, 09 Nội trú < 4h, 04 Ban ngày...).
     - Lọc theo Khoa/Phòng.
     - Lọc theo Nhóm ca (1, 2, 3, 4).
     - Lọc theo Trạng thái (Đúng / Thừa / Thiếu / Lỗi).
     - Ô tìm kiếm nhanh Mã LK hoặc Tên bệnh nhân.
   - **Tab 1 - Tổng hợp theo Khoa/Phòng**: Bảng xếp hạng các khoa phòng làm đúng/sai, số ngày lệch và tỷ lệ tuân thủ (%).
   - **Tab 2 - Chi tiết Hồ sơ Bệnh nhân**: Bảng liệt kê toàn bộ bệnh nhân, thời gian nằm, phân loại nhóm ca, số giường chuẩn, số giường XML3 và độ lệch $\Delta$.
3. Bấm nút **"Xuất Excel"** để tải file báo cáo `.xlsx` hoàn chỉnh 2 sheet (Tổng hợp khoa và Chi tiết bệnh nhân) phục vụ công tác giao ban chuyên môn.

