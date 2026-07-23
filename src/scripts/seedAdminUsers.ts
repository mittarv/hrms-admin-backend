import { connectDB, seedInitialAdminUsers } from '../models';

const runSeed = async () => {
  try {
    console.log('Connecting to database and running admin users seed...');
    await connectDB();
    console.log('Seed migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed migration failed:', error);
    process.exit(1);
  }
};

runSeed();
