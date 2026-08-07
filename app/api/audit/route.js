import { getSessionUser, unauthorizedResponse } from '../../../lib/auth';
import { getCachedAuditLogs } from '../../../lib/cached-queries';
import { privateJson } from '../../../lib/cache-headers';

export async function GET(request) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const logs = await getCachedAuditLogs(limit);
    return privateJson(logs);
  } catch (error) {
    console.error('GET /api/audit error:', error);
    return privateJson({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
