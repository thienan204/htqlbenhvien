import { useState, useEffect } from 'react';
import { ITUser } from '../types';

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
        const initData = async () => {
            try {
                fetchITUsers();
                fetchConfiguredFields();
                fetchStaffs();
                fetchDepartments();
            } catch (e) {
                console.error(e);
            }
        };
        initData();
    }, [user]);

    const fetchITUsers = async () => {
        try {
            const res = await fetch(`/api/error-management/duty-roster?targetDepartment=${targetDepartment}`);
            if (res.ok) {
                const data = await res.json();
                setItUsers(data.filter((u: ITUser) => u.isAvailable));
                if (user) {
                    const me = data.find((u: ITUser) => u.id === user.id);
                    if (me) setIsAvailable(me.isAvailable);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchConfiguredFields = async () => {
        try {
            const res = await fetch(`/api/error-management/it-request-config?targetDepartment=${targetDepartment}`);
            if (res.ok) {
                const configData = await res.json();
                setSoftwareErrors(configData.softwareErrors || []);
                setHardwareErrors(configData.hardwareErrors || []);
                setAssignmentMode(configData.assignmentMode || 'A');
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
                if (user && user.role === 'KHOA') {
                    setDepartmentStaff(data.filter((s: any) => s.ma_khoa === user.ma_khoa));
                } else {
                    setDepartmentStaff(data);
                }
            }
        } catch (error) {
            console.error('Failed to fetch staffs', error);
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
