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
