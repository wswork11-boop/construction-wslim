"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = seedDatabase;
const client_1 = require("@prisma/client");
const hash_wasm_1 = require("hash-wasm");
const crypto = __importStar(require("crypto"));
async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    return (0, hash_wasm_1.argon2id)({
        password,
        salt,
        parallelism: 1,
        iterations: 2,
        memorySize: 19456,
        hashLength: 32,
        outputType: 'encoded',
    });
}
async function seedDatabase(prisma) {
    const ownerEmail = (process.env.SEED_OWNER_EMAIL || 'owner@example.com').toLowerCase().trim();
    const ownerPassword = process.env.SEED_OWNER_PASSWORD || 'Password123!';
    const ownerName = process.env.SEED_OWNER_NAME || 'Owner';
    const passwordHash = await hashPassword(ownerPassword);
    const owner = await prisma.user.upsert({
        where: { email: ownerEmail },
        update: {
            name: ownerName,
            role: client_1.Role.OWNER,
            isActive: true,
        },
        create: {
            email: ownerEmail,
            passwordHash,
            name: ownerName,
            role: client_1.Role.OWNER,
            isActive: true,
        },
    });
    const company = await prisma.company.upsert({
        where: { singleton: true },
        update: {},
        create: {
            singleton: true,
            name: 'Contoh Bina Sdn Bhd',
            registrationNo: '201901000001',
            tin: 'C0000000001',
            address: '1 Jalan Contoh, 47000 Sungai Buloh, Selangor',
            phone: '03-0000 0000',
            email: 'office@example.com',
            defaultPaymentTermDays: 30,
            defaultRetentionPercent: 10,
            defaultRetentionCapPercent: 5,
        },
    });
    await prisma.taxRate.upsert({
        where: { name: 'SST 6%' },
        update: {},
        create: {
            name: 'SST 6%',
            percent: 6,
            isDefault: true,
            isActive: true,
        },
    });
    await prisma.taxRate.upsert({
        where: { name: 'No tax' },
        update: {},
        create: {
            name: 'No tax',
            percent: 0,
            isDefault: false,
            isActive: true,
        },
    });
    return { owner, company };
}
if (require.main === module) {
    const prisma = new client_1.PrismaClient();
    seedDatabase(prisma)
        .then(async () => {
        await prisma.$disconnect();
        console.log('Database seeded.');
    })
        .catch(async (err) => {
        console.error(err);
        await prisma.$disconnect();
        process.exit(1);
    });
}
//# sourceMappingURL=seed.js.map