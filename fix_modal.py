import sys

content = open('src/app/clinical-scheduling/schedule/page.tsx', 'r', encoding='utf-8').read()

# 1. Add state for the modal
old_state = "const [useSavedSchedule, setUseSavedSchedule] = useState(false);"
new_state = "const [useSavedSchedule, setUseSavedSchedule] = useState(false);\n    const [isViewSavedModalOpen, setIsViewSavedModalOpen] = useState(false);"
content = content.replace(old_state, new_state)

# 2. Add the View Button
old_btns = "<Button type=\"primary\" danger icon={<DeleteOutlined />} onClick={handleClearSchedule}>Xóa Lịch Đã Lưu (Reset)</Button>"
new_btns = "<Button type=\"primary\" danger icon={<DeleteOutlined />} onClick={handleClearSchedule}>Xóa Lịch Đã Lưu (Reset)</Button>\n                                            <Button type=\"default\" icon={<TableOutlined />} onClick={() => setIsViewSavedModalOpen(true)}>Xem Lịch Đã Lưu</Button>"
content = content.replace(old_btns, new_btns)

# 3. Define the Modal Component
modal_component = """
            <Modal
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
                    rowKey="id"
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
            </Modal>
"""

# Find a good place to insert the modal (before the last closing tag)
content = content.replace("</App>", modal_component + "\n        </App>")

# Make sure TableOutlined is imported
if "TableOutlined" not in content:
    content = content.replace("import { FileExcelOutlined, FilePdfOutlined, PrinterOutlined, EditOutlined, DeleteOutlined, FileAddOutlined, SaveOutlined", "import { FileExcelOutlined, FilePdfOutlined, PrinterOutlined, EditOutlined, DeleteOutlined, FileAddOutlined, SaveOutlined, TableOutlined")

open('src/app/clinical-scheduling/schedule/page.tsx', 'w', encoding='utf-8').write(content)
print('Done view modal UI')
