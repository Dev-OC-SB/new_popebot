/**
 * Health check system for thepopebot.
 * Checks API, Database, Docker, and Environment variables.
 */

import { getDb } from '../db/index.js';
import { getConfig } from '../config.js';
import http from 'http';

/**
 * Required environment variables for thepopebot to function.
 * @type {string[]}
 */
const REQUIRED_ENV_VARS = [
  'AUTH_SECRET',
  'APP_URL',
];

/**
 * Required for full functionality but not critical.
 * @type {string[]}
 */
const OPTIONAL_ENV_VARS = [
  'GH_TOKEN',
  'GH_OWNER',
  'GH_REPO',
  'ANTHROPIC_API_KEY',
  'LLM_PROVIDER',
  'LLM_MODEL',
];

/**
 * Check API (basic server) health.
 * @returns {{status: 'pass' | 'fail', message: string}}
 */
function checkApi() {
  try {
    // Basic check: if we're running, the API is alive
    return { status: 'pass', message: 'Server is running' };
  } catch (err) {
    return { status: 'fail', message: err.message };
  }
}

/**
 * Check Database (SQLite via Drizzle) connectivity.
 * @returns {{status: 'pass' | 'fail', message: string}}
 */
function checkDatabase() {
  try {
    const db = getDb();
    // Simple query to verify connectivity
    db.select().from({}).limit(1).prepare('SELECT 1 as check').get();
    return { status: 'pass', message: 'Database connected successfully' };
  } catch (err) {
    return { status: 'fail', message: `Database error: ${err.message}` };
  }
}

/**
 * Check Docker daemon accessibility.
 * @returns {{status: 'pass' | 'fail', message: string}}
 */
async function checkDocker() {
  try {
    // Try to connect to Docker socket and get version
    const result = await dockerApi('GET', '/version');
    if (result.status === 200) {
      const version = result.data?.Version || 'unknown';
      return { status: 'pass', message: `Docker daemon accessible (version ${version})` };
    }
    return { status: 'fail', message: `Docker API returned status ${result.status}` };
  } catch (err) {
    return { status: 'fail', message: `Docker daemon not accessible: ${err.message}` };
  }
}

/**
 * Make a request to the Docker Engine API via Unix socket.
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @returns {Promise<{status: number, data: object}>}
 */
function dockerApi(method, path) {
  return new Promise((resolve) => {
    const options = {
      socketPath: '/var/run/docker.sock',
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode, data: { message: data } });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ status: 0, data: { message: err.message } });
    });
    req.end();
  });
}

/**
 * Check required environment variables.
 * @returns {{status: 'pass' | 'fail', message: string}}
 */
function checkEnv() {
  const missing = [];
  const present = [];

  for (const key of REQUIRED_ENV_VARS) {
    const value = getConfig(key);
    if (!value) {
      missing.push(key);
    } else {
      present.push(key);
    }
  }

  if (missing.length > 0) {
    return { status: 'fail', message: `Missing required env vars: ${missing.join(', ')}` };
  }

  // Check for critical optional vars
  const criticalOptional = OPTIONAL_ENV_VARS.filter(v =>
    ['GH_TOKEN', 'ANTHROPIC_API_KEY'].includes(v)
  );
  const missingOptional = criticalOptional.filter(v => !getConfig(v));

  if (missingOptional.length > 0) {
    return {
      status: 'pass',
      message: `Required vars present, but missing optional: ${missingOptional.join(', ')}`
    };
  }

  return { status: 'pass', message: 'All required environment variables are set' };
}

/**
 * Run all health checks.
 * @returns {Promise<object>} Health check result
 */
export async function runHealthCheck() {
  // Run all checks in parallel
  const [apiCheck, dbCheck, dockerCheck, envCheck] = await Promise.all([
    Promise.resolve(checkApi()),
    Promise.resolve(checkDatabase()),
    checkDocker(),
    Promise.resolve(checkEnv()),
  ]);

  const checks = {
    api: apiCheck,
    database: dbCheck,
    docker: dockerCheck,
    env: envCheck,
  };

  // Determine overall status
  let status = 'healthy';
  const failedChecks = Object.entries(checks).filter(([, check]) => check.status === 'fail');
  
  if (failedChecks.length > 0) {
    status = failedChecks.length === Object.keys(checks).length ? 'unhealthy' : 'degraded';
  }

  return {
    status,
    checks,
    timestamp: new Date().toISOString(),
  };
}
