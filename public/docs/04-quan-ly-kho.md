# Hướng dẫn Quản lý Vật tư & Kho

Phân hệ Kho giúp bệnh viện quản lý chặt chẽ số lượng vật tư y tế, hóa chất, thiết bị nhập và xuất mỗi ngày.

## 1. Quản lý Nhập Xuất Tồn
- Hệ thống hỗ trợ **Phiếu Nhập** và **Phiếu Xuất** độc lập.
- Khi tạo Phiếu Nhập, bạn có thể thêm các vật tư kèm theo số lô, hạn sử dụng và số lượng.
- **Tính năng Thẻ Kho:** Mỗi mặt hàng sẽ có một Thẻ Kho riêng. Thẻ kho giúp kế toán và thủ kho theo dõi được dòng thời gian (timeline) chi tiết mỗi khi có phiếu nhập hoặc xuất tác động làm thay đổi số lượng tồn kho.

> [!IMPORTANT]
> Tồn kho được hệ thống tính toán **hoàn toàn tự động** dựa trên các Phiếu Nhập và Phiếu Xuất đã được phê duyệt. Tuyệt đối không xóa phiếu nhập/xuất nếu đã có phát sinh giao dịch liên quan đến vật tư đó.

## 2. Theo dõi Thiết bị/Vật tư có Serial
- Đối với các thiết bị lớn hoặc vật tư giá trị cao cần quản lý theo Serial (số series), hệ thống hỗ trợ tích chọn "Có Serial" khi nhập.
- Khi xuất kho, bạn sẽ phải chọn chính xác Serial nào được xuất ra để phân bổ về khoa phòng.

## 3. Import dữ liệu từ Excel
- Để tiết kiệm thời gian khai báo hàng trăm vật tư mới, hệ thống hỗ trợ **Import từ file Excel**.
- **Cách dùng:**
  1. Tải file mẫu (`.xlsx`) về máy.
  2. Điền dữ liệu các mặt hàng theo đúng cấu trúc cột.
  3. Upload ngược lại lên hệ thống. Hệ thống sẽ tự động đọc và tạo các bản ghi tương ứng.
