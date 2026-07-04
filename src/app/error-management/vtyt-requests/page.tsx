import { SharedRequestsPage } from '../it-requests/components/SharedRequestsPage';

export default function VTYTRequestsPage() {
    return <SharedRequestsPage targetDepartment="VTYT" createPath="/error-management/vtyt-requests/create" />;
}
