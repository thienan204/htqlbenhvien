'use client';

import { useEffect } from 'react';
import { getBasePath } from '@/utils/config';

export default function FetchInterceptor() {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
                let [resource, config] = args;
                const basePath = getBasePath();
                
                // Override only string URLs that start with /api/ and don't already have basePath
                if (typeof resource === 'string' && resource.startsWith('/api/') && basePath) {
                    if (!resource.startsWith(basePath)) {
                        resource = `${basePath}${resource}`;
                    }
                } else if (resource instanceof Request && resource.url.startsWith('/api/') && basePath) {
                     // In case Request object is used
                     if (!resource.url.startsWith(basePath)) {
                         resource = new Request(`${basePath}${resource.url}`, resource);
                     }
                }
                
                return originalFetch(resource, config);
            };
        }
    }, []);

    return null;
}
