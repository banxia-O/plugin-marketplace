-- Read-only preflight. Resolve every returned row before applying migration 0004.
SELECT
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
ORDER BY duplicate_count DESC, active_repo_key;
