import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { UserRole, UserStatus } from '../src/generated/prisma/enums';

// const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Starting seed...');

  // Super Admin — idempotent: upsert ensures safe re-runs
  const superAdminEmail = 'superadmin@college.edu';
  const passwordHash = await bcrypt.hash('Admin@1234', 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      password: passwordHash,
      name: 'Super Admin',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const permissions = [
    { code: 'USER_READ', description: 'Read user data' },
    { code: 'USER_WRITE', description: 'Create or update user data' },
    { code: 'AUDIT_READ', description: 'Read audit logs' },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
    });
  }

  const permissionRecords = await prisma.permission.findMany({
    where: { code: { in: permissions.map((p) => p.code) } },
    select: { id: true, code: true },
  });

  const permissionIdByCode = new Map(
    permissionRecords.map((p: any) => [p.code, p.id]),
  );

  const rolePermissionData = [
    {
      role: UserRole.SUPER_ADMIN,
      codes: ['USER_READ', 'USER_WRITE', 'AUDIT_READ'],
    },
    { role: UserRole.ADMIN, codes: ['USER_READ', 'USER_WRITE', 'AUDIT_READ'] },
    { role: UserRole.STAFF, codes: ['USER_READ'] },
    { role: UserRole.STUDENT, codes: ['USER_READ'] },
  ].flatMap((entry) =>
    entry.codes.map((code) => ({
      role: entry.role,
      permissionId: permissionIdByCode.get(code) ?? '',
    })),
  );

  if (rolePermissionData.some((item) => item.permissionId === '')) {
    throw new Error('Missing permission ID for role-permission seed data');
  }

  await prisma.rolePermission.createMany({
    data: rolePermissionData,
    skipDuplicates: true,
  });

  console.log(`✅ Super Admin created/verified: ${superAdmin.email}`);
  console.log('🌱 Seed complete.');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
