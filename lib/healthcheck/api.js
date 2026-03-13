/**
 * Health check API endpoint.
 * GET /api/health
 */

import { runHealthCheck } from '../healthcheck/index.js';

/**
 * Handle GET /api/health
 * Returns health check results for all subsystems.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleHealth(request) {
  try {
    const health = await runHealthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 200 : 503;
    return Response.json(health, { status: statusCode });
  } catch (err) {
    console.error('Health check error:', err);
    return Response.json({
      status: 'unhealthy',
      checks: {
        api: { status: 'fail', message: 'Health check system error' },
        database: { status: 'fail', message: 'Health check system error' },
        docker: { status: 'fail', message: 'Health check system error' },
        env: { status: 'fail', message: 'Health check system error' },
      },
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}

export { handleHealth };
