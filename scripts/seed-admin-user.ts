import { auth } from '../src/auth/auth.cli.config';
import prisma from './prisma-instance';

async function seedAddressHierarchy(): Promise<void> {
  try {
    const username = process.env.ADMIN_USERNAME as string;
    const email = process.env.ADMIN_EMAIL as string;
    const password = process.env.ADMIN_PASSWORD as string;
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connection established');
    const admin = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (admin) {
      console.log('Found admin User .Deleting ....');
      await prisma.user.deleteMany({
        where: { OR: [{ username }, { email }] },
      });
    }

    console.log('Seeding admin with credials: ');
    console.log('[+]Username: ', username);
    console.log('[+]Email: ', email);
    console.log('[+]Password: ', password);

    const user = await auth.api.signUpEmail({
      body: { email, username, password, name: username, rememberMe: false },
    });
    await prisma.user.update({
      where: { id: user.user.id },
      data: { role: 'admin' },
    });
    console.log('🎉 Admin Seed Completed!');
  } catch (error) {
    console.error('Error seeding admin:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedAddressHierarchy().catch((err) => {
  console.error('Failed admin user hierarchy', err);
  process.exitCode = 1;
});
