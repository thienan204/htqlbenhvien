export const getBasePath = () => {
    if (typeof window !== 'undefined') {
        return window.location.pathname.startsWith('/htqlbenhvien') ? '/htqlbenhvien' : '';
    }
    return process.env.NODE_ENV === 'production' ? '/htqlbenhvien' : '';
};
