import React from 'react';
import DataFormClient from '../../components/DataFormClient';

export default async function DynamicFormDataPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <DataFormClient formId={id} />;
}
