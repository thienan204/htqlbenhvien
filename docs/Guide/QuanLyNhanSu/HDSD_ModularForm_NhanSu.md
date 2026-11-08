# HƯỚNG DẪN SỬ DỤNG VÀ KẾ THỪA COMPONENT MODULAR FORM (FORM NHÂN SỰ)

## 1. Giới thiệu tổng quan
Component **`ModularFormModal`** (`src/components/shared/ModularFormModal.tsx`) là giải pháp biểu mẫu (Form) chuẩn hóa cao cấp, thay thế hoàn toàn cơ chế chỉnh sửa % thủ công phức tạp cũ (`ô: 23%`, `L: 25%`). Component này được thiết kế để:
- Dùng cho cả việc **Thêm mới** và **Chỉnh sửa** hồ sơ dữ liệu lớn (như Quản lý Nhân sự với 35+ trường thông tin).
- Hỗ trợ **2 chế độ hiển thị linh hoạt**:
  1. **Chế độ Phân Tab**: Sử dụng thẻ Ant Design Tabs chuẩn `type="card"`, tự động gắn Badge đếm số lỗi nếu điền thiếu trường bắt buộc và tự động chuyển về Tab có lỗi khi bấm Lưu.
  2. **Chế độ Cuộn 1 trang**: Nhóm thông tin theo các thẻ Card sang trọng, tiện lợi cho việc cuộn và rà soát nhanh toàn bộ hồ sơ.
- Cho phép người dùng chuyển đổi tức thì thông qua bộ nút **`Segmented`** ở góc trên form, lưu lại tùy chọn vào CSDL và `localStorage`.
- Tích hợp **Drawer Cấu hình Form** trực quan với nút bật/tắt (Switch On/Off) để ẩn/hiện trường thông tin mà không làm hỏng cấu trúc bố cục.

---

## 2. Hướng dẫn thao tác cho người dùng tại màn hình `/staff`

### Bước 1: Thêm mới hoặc Cập nhật Nhân sự
- **Thêm mới**: Bấm nút **"+ Thêm nhân sự"** trên thanh công cụ. Form sẽ tự động điền trạng thái mặc định *"Đang làm việc"*.
- **Sửa thông tin**: Bấm nút **"Sửa"** tại dòng nhân sự cần chỉnh. Tiêu đề Modal sẽ hiển thị tên và mã nhân viên, dữ liệu ngày tháng và thông tin cá nhân sẽ được nạp đầy đủ.

### Bước 2: Chuyển đổi giữa 2 chế độ xem
- Tại góc trên bên phải của Modal:
  - Chọn **[ 📑 Phân Tab ]**: Xem thông tin chia theo 5 nhóm:
    1. 👤 *Định danh & Cá nhân* (Mã NV, Họ tên, Giới tính, Ngày sinh, CCCD, SĐT, BHXH, Địa chỉ thường trú...).
    2. 📍 *Hộ khẩu & Địa chỉ* (Nơi sinh, Quê quán, Nơi ở hiện tại - chi tiết Thôn/Xóm/Xã/Huyện).
    3. 🏥 *Công tác & Chuyên môn* (Khoa/Phòng, Trạng thái, Loại HĐ, Chức vụ, Vị trí việc làm, Trình độ, Vị trí BHYT...).
    4. 💰 *Tuyển dụng & Tiền lương* (Số QĐ tuyển dụng, Ngày tuyển dụng, Thời điểm nâng lương, Ngạch, Hệ số, Bậc, Phụ cấp...).
    5. 🚪 *Chuyển công tác / Nghỉ việc* (Ngày nghỉ việc, Quyết định, Đơn vị chuyển đến, Lý do...).
  - Chọn **[ 📜 Cuộn 1 trang ]**: Toàn bộ 5 nhóm trên sẽ được hiển thị liền mạch dưới dạng các Card khối gọn gàng, có thể cuộn chuột để xem nhanh từ trên xuống dưới.

### Bước 3: Tùy chỉnh ẩn/hiển thị trường (Nút [ ⚙ Cấu hình ])
- Bấm nút **[ ⚙ Cấu hình ]** ở tiêu đề form để mở bảng điều khiển bên phải.
- Gạt nút **Switch On/Off** của trường bạn muốn ẩn bớt (ví dụ: các trường ít dùng). Các trường bắt buộc (`*`) được khóa cố định để đảm bảo an toàn dữ liệu.
- Bấm **"Lưu cấu hình"**. Cấu hình sẽ được đồng bộ lên máy chủ và lưu lại trên máy tính của bạn.

---

## 3. Hướng dẫn Lập trình viên Kế thừa `ModularFormModal` cho Form khác

Bất kỳ màn hình nào (Vật tư, Thiết bị, Danh mục khoa phòng, Yêu cầu...) đều có thể tái sử dụng theo cú pháp ngắn gọn sau:

```tsx
import ModularFormModal, { FormSectionDef } from '@/components/shared/ModularFormModal';
import { UserOutlined, SettingOutlined } from '@ant-design/icons';

// 1. Khai báo các phân đoạn (Sections) và các trường (Fields)
const sections: FormSectionDef[] = [
    {
        key: 'general',
        title: 'Thông tin chung',
        icon: <UserOutlined />,
        fields: [
            { name: 'code', label: 'Mã số', type: 'text', required: true, span: 12 },
            { name: 'name', label: 'Tên đối tượng', type: 'text', required: true, span: 12 },
            { name: 'category', label: 'Phân loại', type: 'select', span: 12, options: [...] },
            { name: 'created_date', label: 'Ngày tạo', type: 'date', span: 12 },
        ]
    },
    {
        key: 'detail',
        title: 'Thông tin chi tiết',
        icon: <SettingOutlined />,
        fields: [
            { name: 'description', label: 'Mô tả', type: 'textarea', span: 24 },
        ]
    }
];

// 2. Sử dụng component
<ModularFormModal
    formId="custom_module_form"
    title={recordData?.id ? 'Cập nhật' : 'Thêm mới'}
    open={isOpen}
    onClose={() => setIsOpen(false)}
    onSubmit={async (values) => {
        await apiCall(values);
    }}
    initialData={recordData}
    sections={sections}
    width={900}
/>
```
