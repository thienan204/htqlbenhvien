import { discoverApiEndpoints, ApiEndpoint } from '@/actions/api-discovery';
import { getCurrentUser } from '@/actions/auth';
import { redirect } from 'next/navigation';
import { ApiManagementClient } from './components/ApiManagementClient';

export default async function ApiManagementPage() {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'CNTT')) {
        redirect('/');
    }

    const endpoints = await discoverApiEndpoints();

    // Group endpoints by category
    const groupedEndpoints: Record<string, ApiEndpoint[]> = {};
    endpoints.forEach(endpoint => {
        if (!groupedEndpoints[endpoint.category]) {
            groupedEndpoints[endpoint.category] = [];
        }
        groupedEndpoints[endpoint.category].push(endpoint);
    });

    return <ApiManagementClient groupedEndpoints={groupedEndpoints} />;
}
