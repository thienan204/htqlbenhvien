import sys

filepath = 'src/app/clinical-scheduling/schedule/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Using regex to find the button block to avoid exact whitespace matching issues
import re

# Look for the exact button text to replace
content = content.replace("Lưu Lịch Cố Định Vào Hệ Thống", "Lưu vào CSDL")

# Find the space block
pattern = r'(<Space style={{ marginBottom: 16 }}>\s*<Button icon={<FileExcelOutlined \/>} onClick=\{\(\) => handleExportExcelTab\(groupedScheduledData, resultColumns, \'DanhSachTheoBacSi\'\)\}>Tải Excel<\/Button>\s*<Button icon={<FileExcelOutlined \/>} style={{ color: \'#eb2f96\', borderColor: \'#eb2f96\' }} onClick=\{\(\) => handleExportExcelTabFormat2\(groupedScheduledData, \'DanhSachTheoBacSi\'\)\}>Tải Excel \(Mẫu 2\)<\/Button>\s*<Button type="primary" icon={<SaveOutlined \/>} loading=\{savingReport\} onClick=\{\(\) => handleSaveExcelToServer\(groupedScheduledData, resultColumns, \'DanhSachTheoBacSi\'\)\}>Lưu Excel<\/Button>\s*<Button type="primary" style={{ background: \'#52c41a\', borderColor: \'#52c41a\' }} icon={<SaveOutlined \/>} loading=\{loading\} onClick=\{\(\) => handleSaveSchedule\(scheduledData\)\}>Lưu vào CSDL<\/Button>\s*<Button type="default" icon={<TableOutlined \/>} onClick=\{\(\) => window\.open\(`\/htqlbenhvien\/clinical-scheduling\/saved-schedules\?date=\$\{selectedDate\}&maKhoa=\$\{selectedDept\}`, \'_blank\'\)\}>Xem Lịch Đã Lưu \(Tab mới\)<\/Button>\s*<\/Space>)'

new_block = """<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                            <Space>
                                                <Button icon={<FileExcelOutlined />} onClick={() => handleExportExcelTab(groupedScheduledData, resultColumns, 'DanhSachTheoBacSi')}>Tải Excel</Button>
                                                <Button icon={<FileExcelOutlined />} style={{ color: '#eb2f96', borderColor: '#eb2f96' }} onClick={() => handleExportExcelTabFormat2(groupedScheduledData, 'DanhSachTheoBacSi')}>Tải Excel (Mẫu 2)</Button>
                                                <Button type="primary" icon={<SaveOutlined />} loading={savingReport} onClick={() => handleSaveExcelToServer(groupedScheduledData, resultColumns, 'DanhSachTheoBacSi')}>Lưu Excel</Button>
                                            </Space>
                                            <Space>
                                                <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} icon={<SaveOutlined />} loading={loading} onClick={() => handleSaveSchedule(scheduledData)}>Lưu vào CSDL</Button>
                                                <Button type="default" icon={<TableOutlined />} onClick={() => window.open(`/htqlbenhvien/clinical-scheduling/saved-schedules?date=${selectedDate}&maKhoa=${selectedDept}`, '_blank')}>Xem Lịch Đã Lưu (Tab mới)</Button>
                                            </Space>
                                        </div>"""

if re.search(pattern, content):
    content = re.sub(pattern, new_block, content)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Replaced successfully!')
else:
    print('Pattern not found!')
    # Print the relevant portion for debugging
    idx = content.find("Lưu vào CSDL")
    if idx != -1:
        start = max(0, idx - 500)
        end = min(len(content), idx + 500)
        print(content[start:end])
