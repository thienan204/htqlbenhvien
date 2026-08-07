import React from 'react';
import SubmitFormClient from '../../components/SubmitFormClient';

export default async function SubmitDynamicFormPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <SubmitFormClient formId={id} />;
}
