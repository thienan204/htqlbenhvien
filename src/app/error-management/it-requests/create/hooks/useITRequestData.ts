import { useState, useEffect } from 'react';
import { getBasePath } from '@/utils/config';

export function useITRequestData(isAdmin: boolean, userRole: string | undefined, userMaKhoa: string | undefined, userStaffId: string | undefined, form: any, targetDepartment: string = 'CNTT', isManager: boolean = false) {
    const [softwareErrors, setSoftwareErrors] = useState<string[]>([]);
    const [hardwareErrors, setHardwareErrors] = useState<string[]>([]);
    const [allStaffs, setAllStaffs] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [departmentStaff, setDepartmentStaff] = useState<any[]>([]);
    const [itUsers, setItUsers] = useState<any[]>([]);
    const [maxImageSizeMB, setMaxImageSizeMB] = useState<number>(10);
    const [maBaLength, setMaBaLength] = useState<number>(11);
    const [savedStaffId, setSavedStaffId] = useState<string | null>(null);

    useEffect(() => {
        const fetchConfiguredFields = async () => {
            try {
                const res = await fetch(`${getBasePath()}/api/error-management/it-request-config?targetDepartment=${targetDepartment}`);
                if (res.ok) {
                    const configData = await res.json();
                    setSoftwareErrors(configData.softwareErrors || []);
                    setHardwareErrors(configData.hardwareErrors || []);
                    if (configData.maxImageSizeMB) {
                        setMaxImageSizeMB(configData.maxImageSizeMB);
                    }
                    if (configData.maBaLength) {
                        setMaBaLength(configData.maBaLength);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch config', error);
            }
        };

        const fetchDepartments = async () => {
            try {
                const res = await fetch(`${getBasePath()}/api/departments`);
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
                const res = await fetch(`${getBasePath()}/api/staff`);
                if (res.ok) {
                    const data = await res.json();
                    setAllStaffs(data);
                    let currentStaffList = data;
                    if (userRole === 'KHOA' && userMaKhoa) {
                        currentStaffList = data.filter((s: any) => s.ma_khoa === userMaKhoa);
                    }
                    setDepartmentStaff(currentStaffList);

                    // Xác định nhân viên được chọn mặc định cho Khoa
                    const storedLastId = localStorage.getItem('last_it_request_staff_id');
                    let chosenId: string | null = null;

                    if (userStaffId && currentStaffList.some((s: any) => s.id === userStaffId)) {
                        chosenId = userStaffId;
                    } else if (storedLastId && currentStaffList.some((s: any) => s.id === storedLastId)) {
                        chosenId = storedLastId;
                    } else if (currentStaffList.length > 0) {
                        chosenId = currentStaffList[0].id;
                    }

                    if (chosenId) {
                        setSavedStaffId(chosenId);
                    } else {
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
                const res = await fetch(`${getBasePath()}/api/error-management/duty-roster?targetDepartment=${targetDepartment}`);
                if (res.ok) {
                    const data = await res.json();
                    const isManagerOrAdmin = isAdmin;
                    if (isManagerOrAdmin) {
                        setItUsers(data.filter((u: any) => u.role === targetDepartment));
                    } else {
                        setItUsers(data.filter((u: any) => u.isAvailable && u.role === targetDepartment));
                    }
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
                if (isAdmin || isManager) {
                    fetchITUsers();
                }
            } catch (e) {
                console.error(e);
            }
        };
        initData();
        
        const lastStaffId = userStaffId || localStorage.getItem('last_it_request_staff_id');
        setSavedStaffId(lastStaffId);
    }, [isAdmin, userRole, userMaKhoa, userStaffId, targetDepartment]);

    return {
        softwareErrors,
        hardwareErrors,
        allStaffs,
        departments,
        departmentStaff,
        setDepartmentStaff,
        itUsers,
        maxImageSizeMB,
        maBaLength,
        savedStaffId,
        setSavedStaffId
    };
}
