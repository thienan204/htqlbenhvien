import React from 'react';
import SubmitFormClient from '../../components/SubmitFormClient';
import prisma from '@/lib/prisma';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const form = await prisma.dynamicForm.findUnique({
        where: { id }
    });
    
    if (form) {
        return {
            title: form.name,
        };
    }
    return {
        title: 'Biểu mẫu',
    };
}

export default async function SubmitDynamicFormPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <SubmitFormClient formId={id} />;
}
