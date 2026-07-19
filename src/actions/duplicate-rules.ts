'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getDuplicateRules() {
    try {
        const rules = await prisma.duplicateRule.findMany({
            orderBy: {
                createdAt: 'desc'
            }
        });
        return { success: true, data: rules };
    } catch (error) {
        console.error("Error fetching rules:", error);
        return { success: false, error: "Failed to fetch rules" };
    }
}

export async function createDuplicateRule(data: {
    name: string;
    machineCols: string[];
    serviceCol?: string;
    startCol: string;
    endCol: string;
    ignoreMaMayMinusOne: boolean;
    ignoreNullValues?: boolean;
    active?: boolean;
    serviceValues?: string[];
    excludedServiceValues?: string[];
    ignoreIfSameField?: string;
    minGapMinutes?: number;
}) {
    try {
        const newRule = await prisma.duplicateRule.create({
            data: {
                name: data.name,
                machineCols: data.machineCols,
                serviceCol: data.serviceCol,
                startCol: data.startCol,
                endCol: data.endCol,
                ignoreMaMayMinusOne: data.ignoreMaMayMinusOne,
                ignoreNullValues: data.ignoreNullValues || false,
                active: data.active !== undefined ? data.active : true,
                serviceValues: data.serviceValues || [],
                excludedServiceValues: data.excludedServiceValues || [],
                minGapMinutes: data.minGapMinutes || 0,
            }
        });
        if ('ignoreIfSameField' in data) {
            await prisma.$executeRaw`UPDATE "DuplicateRule" SET "ignoreIfSameField" = ${data.ignoreIfSameField || null} WHERE "id" = ${newRule.id}`;
        }
        revalidatePath('/doc-file-excel');
        return { success: true, data: newRule };
    } catch (error) {
        console.error("Error creating rule:", error);
        return { success: false, error: "Failed to create rule" };
    }
}

export async function updateDuplicateRule(id: string, data: {
    name: string;
    machineCols: string[];
    serviceCol?: string;
    startCol: string;
    endCol: string;
    ignoreMaMayMinusOne: boolean;
    ignoreNullValues?: boolean;
    active?: boolean;
    serviceValues?: string[];
    excludedServiceValues?: string[];
    ignoreIfSameField?: string;
    minGapMinutes?: number;
}) {
    try {
        const updatedRule = await prisma.duplicateRule.update({
            where: { id },
            data: {
                name: data.name,
                machineCols: data.machineCols,
                serviceCol: data.serviceCol,
                startCol: data.startCol,
                endCol: data.endCol,
                ignoreMaMayMinusOne: data.ignoreMaMayMinusOne,
                ignoreNullValues: data.ignoreNullValues || false,
                active: data.active,
                serviceValues: data.serviceValues || [],
                excludedServiceValues: data.excludedServiceValues || [],
                minGapMinutes: data.minGapMinutes || 0,
            }
        });
        if ('ignoreIfSameField' in data) {
            await prisma.$executeRaw`UPDATE "DuplicateRule" SET "ignoreIfSameField" = ${data.ignoreIfSameField || null} WHERE "id" = ${id}`;
        }
        revalidatePath('/doc-file-excel');
        return { success: true, data: updatedRule };
    } catch (error) {
        console.error("Error updating rule:", error);
        return { success: false, error: "Failed to update rule" };
    }
}

export async function deleteDuplicateRule(id: string) {
    try {
        await prisma.duplicateRule.delete({
            where: { id }
        });
        revalidatePath('/doc-file-excel');
        return { success: true };
    } catch (error) {
        console.error("Error deleting rule:", error);
        return { success: false, error: "Failed to delete rule" };
    }
}
