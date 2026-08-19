import sys

content = open('src/app/clinical-scheduling/schedule/page.tsx', 'r', encoding='utf-8').read()

# 1. Remove state
content = content.replace("\n    const [isViewSavedModalOpen, setIsViewSavedModalOpen] = useState(false);", "")

# 2. Update button
old_btn = "<Button type=\"default\" icon={<TableOutlined />} onClick={() => setIsViewSavedModalOpen(true)}>Xem Lịch Đã Lưu</Button>"
new_btn = "<Button type=\"default\" icon={<TableOutlined />} onClick={() => window.open(`/htqlbenhvien/clinical-scheduling/saved-schedules?date=${selectedDate}&maKhoa=${selectedDept}`, '_blank')}>Xem Lịch Đã Lưu (Tab mới)</Button>"
content = content.replace(old_btn, new_btn)

# 3. Remove Modal
modal_str = """            <Modal
                title={`Danh sách Lịch đã lưu trong Cơ sở dữ liệu (${savedSchedules.length} dịch vụ)`}
                open={isViewSavedModalOpen}
                onCancel={() => setIsViewSavedModalOpen(false)}
                footer={[
                    <Button key="close" onClick={() => setIsViewSavedModalOpen(false)}>Đóng</Button>
                ]}
                width={1000}
            >
                <Table
                    dataSource={savedSchedules}
                    rowKey={(r) => r.id || `${r.so_phieu}_${r.ma_dich_vu}_${r.bat_dau}`}
                    size="small"
                    pagination={{ pageSize: 20 }}
                    columns={[
                        { title: 'Tên Bệnh nhân', dataIndex: 'ten_benh_nhan', key: 'ten_benh_nhan', width: 200 },
                        { title: 'Tên Dịch vụ', dataIndex: 'ten_dich_vu', key: 'ten_dich_vu', width: 250 },
                        { title: 'Số phiếu', dataIndex: 'so_phieu', key: 'so_phieu', width: 100 },
                        { title: 'Bắt đầu', dataIndex: 'bat_dau', key: 'bat_dau', width: 100, align: 'center' },
                        { title: 'Kết thúc', dataIndex: 'ket_thuc', key: 'ket_thuc', width: 100, align: 'center' },
                        { title: 'Người thực hiện', dataIndex: 'nguoi_thuc_hien', key: 'nguoi_thuc_hien' },
                        { title: 'Máy', dataIndex: 'ten_may', key: 'ten_may' }
                    ]}
                />
            </Modal>"""
content = content.replace(modal_str, "")

open('src/app/clinical-scheduling/schedule/page.tsx', 'w', encoding='utf-8').write(content)
print('Done update to separate tab')
