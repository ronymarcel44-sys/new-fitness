// fitai-backend/src/lib/prisma.ts
//
// هذا الملف ينشئ اتصالاً واحداً بقاعدة البيانات ويشاركه مع كل الملفات الأخرى
//
// لماذا Singleton؟
// بدون هذا النمط، كل مرة تستورد PrismaClient في ملف مختلف تُنشأ اتصالات جديدة
// وهذا يسبب مشاكل خصوصاً مع ts-node-dev الذي يُعيد تحميل الملفات عند كل تعديل
//
// الاستخدام في أي ملف آخر:
// import { prisma } from "@/lib/prisma";
// const users = await prisma.user.findMany();

import { PrismaClient } from "@prisma/client";

// نربط الـ instance بـ globalThis حتى لا تتضاعف عند إعادة التحميل في التطوير
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"], // اطبع فقط الأخطاء — غيّرها إلى ["query", "error"] إذا تريد رؤية كل استعلام
  });

// في بيئة التطوير فقط — احفظ الـ instance على globalThis
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
