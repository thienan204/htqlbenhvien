import { useState, useEffect } from 'react';
import { ITUser } from '../types';
import { getBasePath } from '@/utils/config';

export const useITMasterData = (user: any, targetDepartment: string = 'CNTT') => {
    const [itUsers, setItUsers] = useState<ITUser[]>([]);
    const [softwareErrors, setSoftwareErrors] = useState<string[]>([]);
    const [hardwareErrors, setHardwareErrors] = useState<string[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [allStaffs, setAllStaffs] = useState<any[]>([]);
    const [departmentStaff, setDepartmentStaff] = useState<any[]>([]);
    const [assignmentMode, setAssignmentMode] = useState<string>('A');
    const [isAvailable, setIsAvailable] = useState<boolean>(false);

    useEffect(() => {
        let isMounted = true;
        const initData = async () => {
            try {
                await Promise.allSettled([
                    fetchITUsers(),
                    fetchConfiguredFields(),
                    fetchStaffs(),
                    fetchDepartments()
                ]);
            } catch (e) {
                console.warn('Init master data warning:', e);
            }
        };
        initData();
        return () => { isMounted = false; };
    }, [user, targetDepartment]);

    const fetchITUsers = async () => {
        try {
            const res = await fetch(`${getBasePath()}/api/error-management/duty-roster?targetDepartment=${targetDepartment}`);
            if (res.ok) {
                const data = await res.json();
                setItUsers(data.filter((u: ITUser) => u.isAvailable));
                if (user) {
                    const me = data.find((u: ITUser) => u.id === user.id);
                    if (me) setIsAvailable(me.isAvailable);
                }
            }
        } catch (error) {
            console.warn('Fetch IT users warning:', error);
        }
    };

    const fetchConfiguredFields = async () => {
        try {
            const res = await fetch(`${getBasePath()}/api/error-management/it-request-config?targetDepartment=${targetDepartment}`);
            if (res.ok) {
                const configData = await res.json();
                setSoftwareErrors(configData.softwareErrors || []);
                setHardwareErrors(configData.hardwareErrors || []);
                setAssignmentMode(configData.assignmentMode || 'A');
                if (configData.notificationSound) {
                    localStorage.setItem(`${targetDepartment}_department_notification_sound`, JSON.stringify(configData.notificationSound));
                }
            }
        } catch (error) {
            console.warn('Fetch config warning:', error);
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
            console.warn('Fetch departments warning:', error);
        }
    };

    const fetchStaffs = async () => {
        try {
            const res = await fetch(`${getBasePath()}/api/staff`);
            if (res.ok) {
                const data = await res.json();
                setAllStaffs(data);
                const isDepartmentUser = !['ADMIN', 'CNTT', 'VTYT', 'HCQT'].includes(user?.role) || user?.role === 'KHOA' || user?.role === 'KHOA_PHONG';
                if (user && isDepartmentUser && user.ma_khoa) {
                    setDepartmentStaff(data.filter((s: any) => s.ma_khoa === user.ma_khoa));
                } else {
                    setDepartmentStaff(data);
                }
            }
        } catch (error) {
            console.warn('Fetch staffs warning:', error);
        }
    };

    return {
        itUsers,
        softwareErrors,
        hardwareErrors,
        departments,
        allStaffs,
        departmentStaff,
        assignmentMode,
        isAvailable,
        setIsAvailable,
        fetchITUsers
    };
};
