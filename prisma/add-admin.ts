import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.NEW_ADMIN_EMAIL || 'admin2@nftmarketplace.com';
  const username = process.env.NEW_ADMIN_USERNAME || 'admin2';
  const password = process.env.NEW_ADMIN_PASSWORD || 'Admin456!';

  console.log('👤 Adding new admin user...');
  console.log('📧 Email:', email);
  console.log('👤 Username:', username);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }]
    }
  });

  if (existing) {
    console.log('⚠️  A user with this email/username already exists. Skipping creation.');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      email,
      username,
      firstName: 'Admin',
      lastName: 'User',
      bio: 'Secondary administrator account',
      passwordHash: hashedPassword,
      isAdmin: true,
      isVerified: true,
    },
  });

  console.log('✅ New admin created successfully!');
  console.log('🆔 ID:', admin.id);
  console.log('🔑 Temporary Password:', password);
  console.log('⚠️  Please change this password after first login.');
}

main()
  .catch((e) => {
    console.error('❌ Error creating admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });