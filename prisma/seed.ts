import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const adminEmail = 'admin@nftmarketplace.com';
  const adminUsername = 'admin';
  const adminPassword = 'Admin123!'; // Change this to a secure password

  // Check if admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: adminEmail },
        { username: adminUsername },
        { isAdmin: true }
      ]
    }
  });

  if (existingAdmin) {
    console.log('✅ Admin user already exists:', existingAdmin.email);
  } else {
    // Hash the password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        username: adminUsername,
        firstName: 'System',
        lastName: 'Administrator',
        passwordHash: hashedPassword,
        isAdmin: true,
        isVerified: true,
        bio: 'System Administrator - Full access to all platform features',
      }
    });

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', admin.email);
    console.log('👤 Username:', admin.username);
    console.log('🔑 Password:', adminPassword);
    console.log('⚠️  Please change the default password after first login!');
  }

  // Create some sample system settings if they don't exist
  const existingSettings = await prisma.systemSetting.findMany();
  
  if (existingSettings.length === 0) {
    const defaultSettings = [
      {
        key: 'platformFeePercentage',
        value: '2.5',
        description: 'Platform fee percentage for transactions'
      },
      {
        key: 'maxFileSize',
        value: '10485760', // 10MB
        description: 'Maximum file size for NFT uploads in bytes'
      },
      {
        key: 'allowedFileTypes',
        value: 'image/jpeg,image/png,image/gif,image/webp,video/mp4',
        description: 'Allowed file types for NFT uploads'
      },
      {
        key: 'minAuctionDuration',
        value: '3600', // 1 hour
        description: 'Minimum auction duration in seconds'
      },
      {
        key: 'maxAuctionDuration',
        value: '2592000', // 30 days
        description: 'Maximum auction duration in seconds'
      },
      {
        key: 'maintenanceMode',
        value: 'false',
        description: 'Enable maintenance mode to restrict access'
      }
    ];

    for (const setting of defaultSettings) {
      await prisma.systemSetting.create({
        data: setting
      });
    }

    console.log('✅ Default system settings created');
  }

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });