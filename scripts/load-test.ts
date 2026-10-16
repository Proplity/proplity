import autocannon, { Result } from 'autocannon';
import fs from 'fs';
import path from 'path';

interface LoadScenario {
  name: string;
  endpoint: string;
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
  connections: number;
  duration: number;
  description: string;
}

const DEFAULT_BASE_URL = process.env.TARGET_URL || 'http://localhost:3000';

function parseArgs() {
  const args = process.argv.slice(2);
  let baseUrl = DEFAULT_BASE_URL;
  let durationMultiplier = 1;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      baseUrl = args[i + 1].replace(/\/+$/, '');
      i++;
    } else if (args[i] === '--quick') {
      durationMultiplier = 0.5;
    }
  }
  return { baseUrl, durationMultiplier };
}

async function verifyServer(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/health`, { signal: AbortSignal.timeout(4000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function runScenario(baseUrl: string, scenario: LoadScenario): Promise<Result> {
  console.log(`\n======================================================`);
  console.log(`▶ Running Scenario: ${scenario.name}`);
  console.log(`  ${scenario.description}`);
  console.log(`  URL: ${baseUrl}${scenario.endpoint}`);
  console.log(`  Concurrency: ${scenario.connections} connections | Duration: ${scenario.duration}s`);
  console.log(`======================================================`);

  return new Promise((resolve, reject) => {
    const instance = autocannon(
      {
        url: `${baseUrl}${scenario.endpoint}`,
        method: scenario.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(scenario.headers || {}),
        },
        body: scenario.body,
        connections: scenario.connections,
        duration: scenario.duration,
        pipelining: 1,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      },
    );

    autocannon.track(instance, { renderProgressBar: true });
  });
}

function printSummary(results: { scenario: LoadScenario; result: Result }[]) {
  console.log(`\n\n======================================================`);
  console.log(`📊 PROPLITY LOAD & STRESS TESTING SUMMARY REPORT`);
  console.log(`======================================================`);

  const summaryRows = results.map(({ scenario, result }) => {
    const p95 = (result.latency as unknown as Record<string, number>)['p95'] ?? result.latency.p97_5;
    const p99 = result.latency.p99;
    const rps = result.requests.average;
    const errorCount = result.errors + result.timeouts;
    const prdTargetPassed = p95 < 2000; // PRD target: < 2s under load

    return {
      Scenario: scenario.name,
      'Conns': scenario.connections,
      'Req/s': rps.toFixed(1),
      'p50 (ms)': result.latency.p50,
      'p95 (ms)': p95,
      'p99 (ms)': p99,
      'Errors': errorCount,
      'PRD SLA (<2s)': prdTargetPassed ? '✅ PASS' : '❌ FAIL',
    };
  });

  console.table(summaryRows);

  const allPassed = summaryRows.every((r) => r['PRD SLA (<2s)'].includes('PASS'));
  console.log(`\nOverall PRD Conformance: ${allPassed ? '✅ ALL BENCHMARKS WITHIN 2S SLA' : '❌ VIOLATIONS DETECTED'}\n`);
}

async function main() {
  const { baseUrl, durationMultiplier } = parseArgs();
  console.log(`Target Base URL: ${baseUrl}`);

  const isUp = await verifyServer(baseUrl);
  if (!isUp) {
    console.error(`\n❌ Error: Target server at ${baseUrl} is unreachable.`);
    console.error(`   Please ensure the server is running (e.g. 'pnpm dev' or test server) before executing load tests.`);
    console.error(`   Usage: pnpm tsx scripts/load-test.ts --url http://localhost:3000\n`);
    process.exit(1);
  }

  const scenarios: LoadScenario[] = [
    {
      name: 'Baseline Health Check',
      endpoint: '/api/v1/health',
      connections: 20,
      duration: Math.max(3, Math.round(5 * durationMultiplier)),
      description: 'Measures unauthenticated server baseline throughput and connection overhead.',
    },
    {
      name: 'Public Listing Discovery',
      endpoint: '/api/v1/properties?limit=20',
      connections: 50,
      duration: Math.max(5, Math.round(10 * durationMultiplier)),
      description: 'Tests public property search and pagination under 50 concurrent readers.',
    },
    {
      name: 'Filtered Property Search',
      endpoint: '/api/v1/properties?city=Lagos&minPrice=100000&maxPrice=5000000&limit=20',
      connections: 30,
      duration: Math.max(5, Math.round(10 * durationMultiplier)),
      description: 'Tests multi-column filtered property queries against PostgreSQL.',
    },
    {
      name: 'Auth Concurrency & Rate Limiting',
      endpoint: '/api/v1/auth/login',
      method: 'POST',
      body: JSON.stringify({ email: 'load-test@proplity.internal', password: 'IncorrectPassword123!' }),
      connections: 20,
      duration: Math.max(4, Math.round(6 * durationMultiplier)),
      description: 'Tests PostgreSQL advisory lock serialization and 429 rate limit behavior under burst load.',
    },
    {
      name: 'High Concurrency Spike',
      endpoint: '/api/v1/properties?limit=10',
      connections: 100,
      duration: Math.max(5, Math.round(8 * durationMultiplier)),
      description: 'Simulates high-traffic spike (100 concurrent clients) on catalog endpoints.',
    },
  ];

  const results: { scenario: LoadScenario; result: Result }[] = [];

  for (const scenario of scenarios) {
    const result = await runScenario(baseUrl, scenario);
    results.push({ scenario, result });
  }

  printSummary(results);

  // Save report to disk
  const reportDir = path.resolve(process.cwd(), 'reports/load-test');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const reportPath = path.join(reportDir, 'load-test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`Detailed load test results written to: ${reportPath}`);
}

main().catch((err) => {
  console.error('Fatal load testing error:', err);
  process.exit(1);
});
