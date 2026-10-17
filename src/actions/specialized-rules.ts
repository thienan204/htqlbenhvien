'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getSpecializedRules() {
    try {
        const rules = await prisma.specializedRule.findMany({
            where: {
                ruleType: { notIn: ['SYSTEM_CONFIG', 'USER_SOUND_CONFIG'] }
            },
            orderBy: { order: 'asc' },
        })
        return { success: true, data: rules }
    } catch (error) {
        console.error('Error fetching rules:', error)
        return { success: false, error: 'Failed to fetch rules' }
    }
}

export async function createSpecializedRule(data: {
    name: string
    slug: string
    description?: string
    ruleType: string
    isActive: boolean
    order: number
    logicConfig?: any
}) {
    try {
        await prisma.specializedRule.create({
            data: {
                name: data.name,
                slug: data.slug,
                description: data.description,
                ruleType: data.ruleType,
                isActive: data.isActive,
                order: data.order,
                logicConfig: data.logicConfig || {},
            },
        })
        revalidatePath('/chuyen-de')
        revalidatePath('/chuyen-de/config')
        return { success: true }
    } catch (error) {
        console.error('Error creating rule:', error)
        return { success: false, error: 'Failed to create rule' }
    }
}

export async function updateSpecializedRule(
    id: string,
    data: {
        name: string
        slug: string
        description?: string
        ruleType: string
        isActive: boolean
        order: number
        logicConfig?: any
    }
) {
    try {
        await prisma.specializedRule.update({
            where: { id },
            data: {
                name: data.name,
                slug: data.slug,
                description: data.description,
                ruleType: data.ruleType,
                isActive: data.isActive,
                order: data.order,
                logicConfig: data.logicConfig || {},
            },
        })
        revalidatePath('/chuyen-de')
        revalidatePath('/chuyen-de/config')
        return { success: true }
    } catch (error) {
        console.error('Error updating rule:', error)
        return { success: false, error: 'Failed to update rule' }
    }
}

export async function deleteSpecializedRule(id: string) {
    try {
        await prisma.specializedRule.delete({
            where: { id },
        })
        revalidatePath('/chuyen-de')
        revalidatePath('/chuyen-de/config')
        return { success: true }
    } catch (error) {
        console.error('Error deleting rule:', error)
        return { success: false, error: 'Failed to delete rule' }
    }
}
