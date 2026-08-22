import 'dotenv/config';
import { runMaintenanceScheduleDispatcher } from '../../lib/workers/maintenanceScheduleDispatcher';
import { prisma } from '../../lib/db';

runMaintenanceScheduleDispatcher()
  .then((result) => console.log('Maintenance Schedule Dispatcher:', result))
  .catch((err) => {
    console.error('Maintenance Schedule Dispatcher failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
