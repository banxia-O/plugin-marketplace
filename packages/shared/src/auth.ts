import { z } from 'zod';

/** POST /api/auth/register 请求体 */
export const RegisterRequest = z.object({
  username: z
    .string()
    .min(3, '用户名至少 3 位')
    .max(32, '用户名最多 32 位')
    .regex(/^[A-Za-z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符'),
  email: z.string().email('邮箱格式不正确').optional(),
  password: z.string().min(8, '密码至少 8 位').max(128, '密码最多 128 位'),
});
export type RegisterRequest = z.infer<typeof RegisterRequest>;

/** POST /api/auth/login 请求体（identifier 可为用户名或邮箱） */
export const LoginRequest = z.object({
  identifier: z.string().min(1, '请输入用户名或邮箱'),
  password: z.string().min(1, '请输入密码'),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

/** 鉴权接口返回的当前用户信息（不含敏感字段） */
export const AuthUser = z.object({
  id: z.number().int(),
  username: z.string(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  githubLogin: z.string().nullable(),
});
export type AuthUser = z.infer<typeof AuthUser>;

/** 注册 / 登录 / OAuth 成功的统一返回：JWT + 用户信息 */
export const AuthResponse = z.object({
  token: z.string(),
  user: AuthUser,
});
export type AuthResponse = z.infer<typeof AuthResponse>;
