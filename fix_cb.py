import sys

content = open('src/app/clinical-scheduling/schedule/page.tsx', 'r', encoding='utf-8').read()

# 1. Add state
old_state = "const [heuristic, setHeuristic] = useState('LPT');"
new_state = "const [heuristic, setHeuristic] = useState('LPT');\n    const [useSavedSchedule, setUseSavedSchedule] = useState(true);"
content = content.replace(old_state, new_state)

# 2. Add Checkbox to UI
old_ui = """                                            <Space style={{ marginTop: 8 }}>
                                                <Tooltip title="Thuật toán CŨ: Bốc từng bệnh nhân và xếp lịch liền mạch cho họ từ sáng tới chiều. Ưu tiên: Bệnh nhân không phải chờ đợi. Nhược điểm: Bác sĩ có thể bị thủng lỗ rỗng.">
                                                    <Button"""
new_ui = """                                            <Space style={{ marginTop: 8 }}>
                                                <Tooltip title="Nếu check, hệ thống sẽ đối chiếu với lịch đã lưu trong Cơ sở dữ liệu để tránh xếp đè vào các khung giờ bác sĩ đã có lịch (Phù hợp để xếp lịch nối tiếp Sáng - Chiều). Nếu bỏ check, hệ thống sẽ tính toán lại từ đầu như một ngày trống.">
                                                    <Checkbox 
                                                        checked={useSavedSchedule} 
                                                        onChange={(e) => setUseSavedSchedule(e.target.checked)}
                                                        style={{ marginRight: 8, fontWeight: 'bold', color: '#1890ff' }}
                                                    >
                                                        Kế thừa lịch đã lưu
                                                    </Checkbox>
                                                </Tooltip>
                                                <Tooltip title="Thuật toán CŨ: Bốc từng bệnh nhân và xếp lịch liền mạch cho họ từ sáng tới chiều. Ưu tiên: Bệnh nhân không phải chờ đợi. Nhược điểm: Bác sĩ có thể bị thủng lỗ rỗng.">
                                                    <Button"""
content = content.replace(old_ui, new_ui)

# 3. Update payloads
old_payload_1 = """                    savedSchedules,
                    serviceStaffMappings: enableStaffMapping ? serviceStaffMappings : {}"""
new_payload_1 = """                    savedSchedules: useSavedSchedule ? savedSchedules : [],
                    serviceStaffMappings: enableStaffMapping ? serviceStaffMappings : {}"""
content = content.replace(old_payload_1, new_payload_1)

old_payload_2 = """                    savedSchedules, // Inject saved schedules here
                    serviceStaffMappings: enableStaffMapping ? serviceStaffMappings : {},
                    heuristic"""
new_payload_2 = """                    savedSchedules: useSavedSchedule ? savedSchedules : [], // Inject saved schedules here
                    serviceStaffMappings: enableStaffMapping ? serviceStaffMappings : {},
                    heuristic"""
content = content.replace(old_payload_2, new_payload_2)

open('src/app/clinical-scheduling/schedule/page.tsx', 'w', encoding='utf-8').write(content)
print('Done add checkbox')
