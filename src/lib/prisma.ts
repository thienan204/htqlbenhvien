import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: ['query', 'error', 'warn'],
  })
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

// Nếu globalThis.prisma đang dùng instance cũ chưa có model mới thì khởi tạo lại
const prisma = (globalThis.prisma && (globalThis.prisma as any).staffAttendanceCheckLog)
  ? globalThis.prisma
  : prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
