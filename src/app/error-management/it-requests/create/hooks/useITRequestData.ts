import { useState, useEffect } from 'react';

export function useITRequestData(isAdmin: boolean, userRole: string | undefined, userMaKhoa: string | undefined, userStaffId: string | undefined, form: any) {
    const [softwareErrors, setSoftwareErrors] = useState<string[]>([]);
    const [hardwareErrors, setHardwareErrors] = useState<string[]>([]);
    const [allStaffs, setAllStaffs] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [departmentStaff, setDepartmentStaff] = useState<any[]>([]);
    const [itUsers, setItUsers] = useState<any[]>([]);
    const [maxImageSizeMB, setMaxImageSizeMB] = useState<number>(10);
    const [savedStaffId, setSavedStaffId] = useState<string | null>(null);

    useEffect(() => {
        const fetchConfiguredFields = async () => {
            try {
                const res = await fetch('/api/error-management/it-request-config');
                if (res.ok) {
                    const configData = await res.json();
                    setSoftwareErrors(configData.softwareErrors || []);
                    setHardwareErrors(configData.hardwareErrors || [
                        'Máy tính không lên',
                        'Hết mực in / Kẹt giấy',
                        'Mất mạng Internet',
                        'Lỗi bàn phím / Chuột',
                        'Khác'
                    ]);
                    if (configData.maxImageSizeMB) {
                        setMaxImageSizeMB(configData.maxImageSizeMB);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch config', error);
            }
        };

        const fetchDepartments = async () => {
            try {
                const res = await fetch('/api/departments');
                if (res.ok) {
                    const data = await res.json();
                    setDepartments(data);
                }
            } catch (error) {
                console.error('Failed to fetch departments', error);
            }
        };

        const fetchStaffs = async () => {
            try {
                const res = await fetch('/api/staff');
                if (res.ok) {
                    const data = await res.json();
                    setAllStaffs(data);
                    let currentStaffList = data;
                    if (userRole === 'KHOA' && userMaKhoa) {
                        currentStaffList = data.filter((s: any) => s.ma_khoa === userMaKhoa);
                    }
                    setDepartmentStaff(currentStaffList);

                    // Verify if the saved staff ID is still valid
                    const lastId = form.getFieldValue('nguoi_bao_id');
                    if (lastId && !currentStaffList.some((s: any) => s.id === lastId)) {
                        form.setFieldsValue({ nguoi_bao_id: undefined });
                        setSavedStaffId(null);
                        localStorage.removeItem('last_it_request_staff_id');
                    }
                }
            } catch (error) {
                console.error('Failed to fetch staffs', error);
            }
        };

        const fetchITUsers = async () => {
            try {
                const res = await fetch('/api/error-management/duty-roster');
                if (res.ok) {
                    const data = await res.json();
                    setItUsers(data.filter((u: any) => u.isAvailable));
                }
            } catch (error) {
                console.error(error);
            }
        };

        const initData = async () => {
            try {
                fetchConfiguredFields();
                fetchStaffs();
                fetchDepartments();
                if (isAdmin) {
                    fetchITUsers();
                }
            } catch (e) {
                console.error(e);
            }
        };
        initData();
        
        const lastStaffId = userStaffId || localStorage.getItem('last_it_request_staff_id');
        setSavedStaffId(lastStaffId);
        form.setFieldsValue({
            category: 'SOFTWARE',
            trang_thai_ba: 'Đang điều trị',
            nguoi_bao_id: lastStaffId || undefined
        });
    }, [form, isAdmin, userRole, userMaKhoa, userStaffId]);

    return {
        softwareErrors,
        hardwareErrors,
        allStaffs,
        departments,
        departmentStaff,
        setDepartmentStaff,
        itUsers,
        maxImageSizeMB,
        savedStaffId,
        setSavedStaffId
    };
}
