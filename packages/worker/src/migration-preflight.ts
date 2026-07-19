export interface ActiveRepoConflict {
  activeRepoKey: string;
  count: number;
  submissionIds: string;
}

interface ConflictRow {
  active_repo_key: string;
  duplicate_count: number;
  submission_ids: string;
}

export async function findActiveRepoConflicts(db: D1Database): Promise<ActiveRepoConflict[]> {
  const rows = (
    await db.prepare(`SELECT
      lower(CASE
        WHEN lower(substr(rtrim(repo_url, '/'), -4)) = '.git'
          THEN substr(rtrim(repo_url, '/'), 1, length(rtrim(repo_url, '/')) - 4)
        ELSE rtrim(repo_url, '/')
      END) AS active_repo_key,
      COUNT(*) AS duplicate_count,
      GROUP_CONCAT(id) AS submission_ids
    FROM submissions
    WHERE status IN ('queued', 'processing')
    GROUP BY active_repo_key
    HAVING COUNT(*) > 1
    ORDER BY duplicate_count DESC, active_repo_key`).all<ConflictRow>()
  ).results;
  return rows.map((row) => ({
    activeRepoKey: row.active_repo_key,
    count: row.duplicate_count,
    submissionIds: row.submission_ids,
  }));
}
