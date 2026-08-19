import sys

content = open('src/app/clinical-scheduling/schedule/page.tsx', 'r', encoding='utf-8').read()

# 1. Add handleClearSchedule
clear_handler = """
    const handleClearSchedule = () => {
        Modal.confirm({
            title: 'Xác nhận xóa lịch',
            content: 'Bạn có chắc chắn muốn xóa toàn bộ lịch đã lưu của Khoa này trong ngày này không? Sau khi xóa, bạn có thể xếp lại lịch từ đầu.',
            okText: 'Xóa',
            okType: 'danger',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    setLoading(true);
                    const res = await fetch('/api/clinical-scheduling/save-schedule', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ date: selectedDate, maKhoa: selectedDept, schedules: [] })
                    });
                    const data = await res.json();
                    if (data.success) {
                        message.success('Đã xóa toàn bộ lịch đã lưu!');
                        setSavedSchedules([]);
                    } else {
                        message.error('Lỗi khi xóa: ' + data.message);
                    }
                } catch (e) {
                    message.error('Lỗi khi xóa lịch');
                } finally {
                    setLoading(false);
                }
            }
        });
    };
"""
content = content.replace("    const handleSaveSchedule = async (schedule: any) => {", clear_handler + "\n    const handleSaveSchedule = async (schedule: any) => {")

# 2. Add Clear Button in UI (Right next to Save Button)
old_btns = "<Button type=\"primary\" style={{ background: '#52c41a', borderColor: '#52c41a' }} icon={<SaveOutlined />} loading={loading} onClick={() => handleSaveSchedule(scheduledData)}>Lưu Lịch Cố Định Vào Hệ Thống</Button>"
new_btns = "<Button type=\"primary\" style={{ background: '#52c41a', borderColor: '#52c41a' }} icon={<SaveOutlined />} loading={loading} onClick={() => handleSaveSchedule(scheduledData)}>Lưu Lịch Cố Định Vào Hệ Thống</Button>\n                                            <Button type=\"primary\" danger icon={<DeleteOutlined />} onClick={handleClearSchedule}>Xóa Lịch Đã Lưu (Reset)</Button>"
content = content.replace(old_btns, new_btns)

# 3. Also show a warning banner at the top if there are saved schedules
old_card_top = "<Card style={{ marginBottom: 16 }}>"
new_card_top = """<Card style={{ marginBottom: 16 }}>
                {savedSchedules.length > 0 && (
                    <Alert
                        message={`Đã có ${savedSchedules.length} dịch vụ được khóa lịch trong hệ thống cho ngày này. Nếu bạn Xếp lịch tự động, hệ thống sẽ BẢO LƯU giờ của các dịch vụ này và chỉ xếp giờ mới cho các dịch vụ chưa có.`}
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                        action={<Button danger size="small" onClick={handleClearSchedule}>Xóa lịch cũ để xếp lại từ đầu</Button>}
                    />
                )}"""
content = content.replace(old_card_top, new_card_top)

open('src/app/clinical-scheduling/schedule/page.tsx', 'w', encoding='utf-8').write(content)
print('Done clear schedule UI')
