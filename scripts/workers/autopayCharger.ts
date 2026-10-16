import 'dotenv/config';
import { runAutopayCharger } from '../../lib/workers/autopayCharger';
import { prisma } from '../../lib/db';

runAutopayCharger()
  .then((result) => console.log('Autopay Charger:', result))
  .catch((err) => {
    console.error('Autopay Charger failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
