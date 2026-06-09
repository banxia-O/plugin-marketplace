import type { AgentMdStatus, DeployMethod, ReviewStatus, SortOrder } from '@ppx/shared';

export const deployLabel: Record<DeployMethod, string> = {
  local: '本地部署',
  remote: '远程服务',
  both: '两者皆可',
};

export const deployTagClass: Record<DeployMethod, string> = {
  local: 'tag-deploy-local',
  remote: 'tag-deploy-remote',
  both: 'tag-deploy-both',
};

export const reviewLabel: Record<ReviewStatus, string> = {
  verified: '✅ 已审核',
  basic: '⚠️ 基础审核',
  rejected: '❌ 未通过',
};

export const reviewTagClass: Record<ReviewStatus, string> = {
  verified: 'tag-verified',
  basic: 'tag-basic',
  rejected: 'tag-pending',
};

export const agentMdLabel: Record<AgentMdStatus, string> = {
  ok: 'agent.md 就绪',
  pending: 'agent.md 生成中',
  incomplete: '⚠️ agent.md 待完善',
};

export const sortOptions: Array<{ value: SortOrder; label: string }> = [
  { value: 'comprehensive', label: '综合' },
  { value: 'newest', label: '最新' },
  { value: 'hottest', label: '最热' },
  { value: 'top_rated', label: '好评' },
];
