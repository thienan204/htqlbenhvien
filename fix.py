import sys

content = open('src/app/clinical-scheduling/schedule/page.tsx', 'r', encoding='utf-8').read()

# 1. Add savedSchedules state
old_state = "const [scheduledData, setScheduledData] = useState<any[]>([]);"
new_state = "const [scheduledData, setScheduledData] = useState<any[]>([]);\n    const [savedSchedules, setSavedSchedules] = useState<any[]>([]);\n    const [loadingSaved, setLoadingSaved] = useState(false);"
content = content.replace(old_state, new_state)

# 2. Fetch saved schedules
old_effect = """    useEffect(() => {
        if (selectedDate && selectedDept) {
            fetch(`/api/clinical-scheduling/attendance?date=${selectedDate}&maKhoa=${selectedDept}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.staffList) {
                        setStaffList(data.staffList);
                    }
                })
                .catch(console.error);
        }
    }, [selectedDate, selectedDept]);"""

new_effect = """    useEffect(() => {
        if (selectedDate && selectedDept) {
            fetch(`/api/clinical-scheduling/attendance?date=${selectedDate}&maKhoa=${selectedDept}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.staffList) {
                        setStaffList(data.staffList);
                    }
                })
                .catch(console.error);

            // Fetch saved schedules
            setLoadingSaved(true);
            fetch(`/api/clinical-scheduling/get-schedule?date=${selectedDate}&maKhoa=${selectedDept}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success) setSavedSchedules(data.schedules || []);
                })
                .catch(console.error)
                .finally(() => setLoadingSaved(false));
        }
    }, [selectedDate, selectedDept]);"""
content = content.replace(old_effect, new_effect)

# 3. Add handleSaveSchedule & inject savedSchedules to payload
save_handler = """
    const handleSaveSchedule = async (schedule: any) => {
        try {
            const res = await fetch('/api/clinical-scheduling/save-schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: selectedDate, maKhoa: selectedDept, schedules: schedule })
            });
            const data = await res.json();
            if (data.success) {
                message.success('Đã lưu lịch thành công vào hệ thống!');
            } else {
                message.error('Lỗi khi lưu: ' + data.message);
            }
        } catch (e) {
            message.error('Lỗi khi lưu lịch');
        }
    };
"""
content = content.replace("    const handleGenerateSchedule = async () => {", save_handler + "\n    const handleGenerateSchedule = async () => {")

old_payload = """                body: JSON.stringify({
                    date: selectedDate,
                    maKhoa: selectedDept,
                    services: filteredData,
                    patientShifts,
                    staffShifts,
                    morningStaffs,
                    afternoonStaffs,
                    serviceStaffMappings: enableStaffMapping ? serviceStaffMappings : {},
                    heuristic
                })"""
new_payload = """                body: JSON.stringify({
                    date: selectedDate,
                    maKhoa: selectedDept,
                    services: filteredData,
                    patientShifts,
                    staffShifts,
                    morningStaffs,
                    afternoonStaffs,
                    savedSchedules, // Inject saved schedules here
                    serviceStaffMappings: enableStaffMapping ? serviceStaffMappings : {},
                    heuristic
                })"""
content = content.replace(old_payload, new_payload)

# 4. Insert Save Button
old_btn = "<Button type=\"primary\" icon={<SaveOutlined />} loading={savingReport} onClick={() => handleSaveExcelToServer(groupedScheduledData, resultColumns, 'DanhSachTheoBacSi')}>Lưu Excel</Button>"
new_btn = "<Button type=\"primary\" icon={<SaveOutlined />} loading={savingReport} onClick={() => handleSaveExcelToServer(groupedScheduledData, resultColumns, 'DanhSachTheoBacSi')}>Lưu Excel</Button>\n                                            <Button type=\"primary\" style={{ background: '#52c41a', borderColor: '#52c41a' }} icon={<SaveOutlined />} loading={loading} onClick={() => handleSaveSchedule(scheduledData)}>Lưu Lịch Cố Định Vào Hệ Thống</Button>"
content = content.replace(old_btn, new_btn)

open('src/app/clinical-scheduling/schedule/page.tsx', 'w', encoding='utf-8').write(content)
print('Done frontend edits')
