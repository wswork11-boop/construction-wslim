import { PrismaClient } from '@prisma/client';
export declare function seedDatabase(prisma: PrismaClient): Promise<{
    owner: {
        id: string;
        email: string;
        passwordHash: string;
        name: string;
        phone: string | null;
        role: import("@prisma/client").$Enums.Role;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    };
    company: {
        id: string;
        email: string | null;
        name: string;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
        singleton: boolean;
        registrationNo: string | null;
        tin: string | null;
        sstNo: string | null;
        msicCode: string | null;
        address: string | null;
        logoFileId: string | null;
        bankDetails: string | null;
        defaultPaymentTermDays: number;
        defaultRetentionPercent: import("@prisma/client/runtime/library").Decimal;
        defaultRetentionCapPercent: import("@prisma/client/runtime/library").Decimal;
    };
}>;
