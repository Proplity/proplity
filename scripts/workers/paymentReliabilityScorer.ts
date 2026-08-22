import 'dotenv/config';
import { runPaymentReliabilityScorer } from '../../lib/workers/paymentReliabilityScorer';
import { prisma } from '../../lib/db';

runPaymentReliabilityScorer()
  .then((result) => console.log('Payment Reliability Scorer:', result))
  .catch((err) => {
    console.error('Payment Reliability Scorer failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
