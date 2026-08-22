import 'dotenv/config';
import { runOverdueFlagger } from '../../lib/workers/overdueFlagger';
import { prisma } from '../../lib/db';

runOverdueFlagger()
  .then((result) => console.log('Overdue Flagger:', result))
  .catch((err) => {
    console.error('Overdue Flagger failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
