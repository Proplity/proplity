import 'dotenv/config';
import { runRentInvoicer } from '../../lib/workers/rentInvoicer';
import { prisma } from '../../lib/db';

runRentInvoicer()
  .then((result) => console.log('Rent Invoicer:', result))
  .catch((err) => {
    console.error('Rent Invoicer failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
