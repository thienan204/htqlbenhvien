import { PrismaClient } from '@prisma/client';
import { notFound } from 'next/navigation';
import SubmitFormClient from '../dynamic-forms/components/SubmitFormClient';

const prisma = new PrismaClient();

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const form = await prisma.dynamicForm.findUnique({
        where: { slug }
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

export default async function DynamicFormSlugPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    
    // Find form by slug
    const form = await prisma.dynamicForm.findUnique({
        where: { slug }
    });

    // If no form matches this slug, return Next.js 404 page
    if (!form) {
        notFound();
    }

    // Reuse the existing Submit page component, passing the actual form ID
    return <SubmitFormClient formId={form.id} />;
}
