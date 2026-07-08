# Hướng dẫn gia hạn HTTPS (SSL Let's Encrypt)

Tài liệu này hướng dẫn cách gia hạn chứng chỉ bảo mật (HTTPS) cho hệ thống và xử lý các lỗi thường gặp như "Not Secure" dù đã cài SSL. Chứng chỉ Let's Encrypt mặc định chỉ có thời hạn **90 ngày**, do đó cần phải được gia hạn định kỳ.

## 1. Gia hạn thủ công (Khi web báo lỗi đỏ)

Trong trường hợp chứng chỉ hết hạn và trình duyệt báo lỗi kết nối không an toàn, bạn cần thực hiện lần lượt các bước sau trên máy chủ (thông qua MobaXterm/SSH):

### Bước 1: Xin cấp mới chứng chỉ
```bash
sudo certbot renew
```

### Bước 2: Khởi động lại dịch vụ Nginx
> [!IMPORTANT]  
> Sau khi xin cấp chứng chỉ thành công, chứng chỉ mới chỉ nằm trên ổ cứng. Nginx đang chạy sẽ không tự động nhận diện file này. Bạn **bắt buộc phải khởi động lại** các container Nginx để nó nạp chứng chỉ mới vào bộ nhớ RAM.

```bash
# Restart Nginx quản lý cổng 80/443 (Thư mục ~/nginx-proxy)
docker restart global-nginx

# Restart Nginx quản lý cổng dự án nội bộ (cổng 201)
docker restart htqlbenhvien-nginx-prod
```

> [!TIP]  
> Nếu sau khi chạy lệnh mà trình duyệt (như Chrome) vẫn báo lỗi đỏ, nguyên nhân là do trình duyệt đang cache kết nối TLS cũ. Hãy mở thẻ ẩn danh (**Ctrl + Shift + N**) để kiểm tra, hoặc gõ `chrome://restart` lên thanh địa chỉ của Chrome để xóa hoàn toàn cache kết nối.

---

## 2. Cài đặt gia hạn tự động định kỳ (Khuyên dùng)

Để hệ thống hoạt động ổn định và không cần can thiệp thủ công, chúng ta sử dụng `cron` (hẹn giờ) trên Linux để tự động xin gia hạn và tự khởi động lại Nginx vào ban đêm.

### Bước 1: Mở bảng cấu hình hẹn giờ (crontab)
Trên Terminal của máy chủ, chạy lệnh:
```bash
sudo crontab -e
```
*(Nếu hệ thống hiển thị danh sách các trình soạn thảo, hãy gõ phím số tương ứng với `nano` và nhấn Enter)*

### Bước 2: Thêm lệnh tự động hóa
Dùng phím mũi tên di chuyển xuống dòng dưới cùng của tệp, sau đó dán đoạn lệnh sau:
```bash
0 0 1 * * /usr/bin/certbot renew --post-hook "docker restart global-nginx && docker restart htqlbenhvien-nginx-prod" >> /var/log/certbot-renew.log 2>&1
```

> **Giải thích lệnh:** Đúng 00:00 ngày mùng 1 mỗi tháng, hệ thống sẽ chạy lệnh gia hạn. Ngay sau khi gia hạn xong, nó sẽ kích hoạt cờ `--post-hook` để tự động khởi động lại 2 container Nginx, áp dụng chứng chỉ mới ngay lập tức. Mọi log (nhật ký) sẽ được lưu vào file `certbot-renew.log`.

### Bước 3: Lưu lại cấu hình
- Nhấn tổ hợp phím **Ctrl + O**, rồi nhấn **Enter** để lưu tệp.
- Nhấn tổ hợp phím **Ctrl + X** để thoát khỏi `nano`.

Khi màn hình hiển thị dòng chữ `crontab: installing new crontab`, quá trình cài đặt tự động hóa SSL đã hoàn tất thành công. Hệ thống sẽ duy trì giao thức HTTPS vĩnh viễn.
