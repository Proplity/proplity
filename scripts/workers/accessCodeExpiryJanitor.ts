import 'dotenv/config';
import { runAccessCodeExpiryJanitor } from '../../lib/workers/accessCodeExpiryJanitor';
import { prisma } from '../../lib/db';

runAccessCodeExpiryJanitor()
  .then((result) => console.log('Access Code Expiry Janitor:', result))
  .catch((err) => {
    console.error('Access Code Expiry Janitor failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
