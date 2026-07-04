import { SharedRequestsPage } from '../it-requests/components/SharedRequestsPage';

export default function HCQTRequestsPage() {
    return <SharedRequestsPage targetDepartment="HCQT" createPath="/error-management/hcqt-requests/create" />;
}
