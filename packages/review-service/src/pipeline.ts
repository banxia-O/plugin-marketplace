import type { ReviewJobPayload, ReviewPluginData, ReviewResultPayload } from '@ppx/shared';
import { generateAgentMd, securityScan } from './deepseek.js';
import {
  checkLicense,
  fetchAgentMd,
  fetchPackageJson,
  fetchReadme,
  fetchRepoMeta,
  parseGithubUrl,
} from './github.js';
import type { ReviewEnv } from './env.js';

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function callbackWorker(env: ReviewEnv, result: ReviewResultPayload): Promise<void> {
  if (!env.WORKER_URL) {
    console.warn('[pipeline] WORKER_URL 未配置，跳过回写');
    return;
  }
  const res = await fetch(`${env.WORKER_URL}/api/admin/review-result`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-review-secret': env.REVIEW_SERVICE_SECRET },
    body: JSON.stringify(result),
  });
  if (!res.ok) {
    throw new Error(`Worker callback 返回 ${res.status}: ${await res.text()}`);
  }
}

async function reject(env: ReviewEnv, submissionId: number, reason: string): Promise<void> {
  console.log(`[pipeline] #${submissionId} 拒绝：${reason}`);
  await callbackWorker(env, { status: 'rejected', submissionId, rejectReason: reason });
}

export async function runPipeline(env: ReviewEnv, job: ReviewJobPayload): Promise<void> {
  const { submissionId, repoUrl, name, oneLiner, subcategoryIds, deployMethod, originalAuthor, uploaderUserId } = job;
  console.log(`[pipeline] #${submissionId} 开始审核：${repoUrl}`);

  // Step 0: 解析 GitHub URL
  const parsed = parseGithubUrl(repoUrl);
  if (!parsed) {
    await reject(env, submissionId, '仓库地址不是有效的 GitHub 仓库 URL');
    return;
  }
  const { owner, repo } = parsed;

  // Step 1: 获取仓库元信息
  let meta;
  try {
    meta = await fetchRepoMeta(owner, repo, env.GITHUB_TOKEN);
  } catch (e) {
    await reject(env, submissionId, e instanceof Error ? e.message : '无法访问 GitHub 仓库');
    return;
  }
  if (meta.isPrivate) {
    await reject(env, submissionId, '仓库为私有仓库，不支持收录');
    return;
  }
  if (meta.isArchived) {
    await reject(env, submissionId, '仓库已归档，不再维护');
    return;
  }

  // Step 2: 许可证闸门
  const licenseCheck = checkLicense(meta.license);
  if (!licenseCheck.allowed) {
    await reject(env, submissionId, licenseCheck.reason ?? '许可证不符合收录条件');
    return;
  }

  // Step 3: 获取 README
  const readme = await fetchReadme(owner, repo, env.GITHUB_TOKEN);
  const packageJson = await fetchPackageJson(owner, repo, env.GITHUB_TOKEN);

  // Step 4: 安全扫描
  let scanResult = { safe: true, concerns: [] as string[] };
  if (env.DEEPSEEK_API_KEY) {
    scanResult = await securityScan(env.DEEPSEEK_API_KEY, name, readme.content, packageJson);
  }
  if (!scanResult.safe) {
    const reason = `代码安全扫描未通过：${scanResult.concerns.join('；')}`;
    await reject(env, submissionId, reason);
    return;
  }

  // Step 5: agent.md 生成策略
  let agentMd: string | null = null;
  let agentMdStatus: ReviewPluginData['agentMdStatus'] = 'incomplete';

  // 优先使用仓库自带的 agent.md
  const existingAgentMd = await fetchAgentMd(owner, repo, env.GITHUB_TOKEN);
  if (existingAgentMd) {
    agentMd = existingAgentMd;
    agentMdStatus = 'ok';
  } else if (readme.adequate && env.DEEPSEEK_API_KEY) {
    // README 信息充分 → 调 DeepSeek 生成
    try {
      agentMd = await generateAgentMd(env.DEEPSEEK_API_KEY, name, readme.content, deployMethod);
      agentMdStatus = 'ok';
    } catch (e) {
      console.error('[pipeline] agent.md 生成失败，标记 pending:', e);
      agentMdStatus = 'pending';
    }
  } else if (!readme.adequate) {
    // README 不足，不消耗 token
    agentMdStatus = 'incomplete';
  }

  // Step 6: 组装插件数据并回写
  const slug = `${toSlug(owner)}-${toSlug(repo)}`;
  const plugin: ReviewPluginData = {
    slug,
    name,
    oneLiner,
    descriptionMd: readme.content,
    repoUrl,
    agentMd,
    agentMdStatus,
    deployMethod: deployMethod as ReviewPluginData['deployMethod'],
    supportedPlatforms: [],  // Phase 5 手动补充或二期检测
    license: meta.license ?? '未知',
    originalAuthor: originalAuthor || owner,
    originalAuthorUrl: `https://github.com/${owner}`,
    stars: meta.stars,
    lastRepoUpdate: meta.pushedAt,
    reviewStatus: 'basic',
    subcategoryIds,
    uploaderUserId,
  };

  await callbackWorker(env, { status: 'done', submissionId, plugin });
  console.log(`[pipeline] #${submissionId} 审核完成，插件 slug=${slug}`);
}
