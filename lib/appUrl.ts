/**
 * The app's own public base URL, for links embedded in outbound email.
 *
 * Every verification/invite/moderation email used to hardcode
 * `http://localhost:3000`, which silently produces dead links in every
 * environment except a developer's laptop -- the kind of bug that only
 * surfaces once a real user clicks one.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_APP_URL -- set this in production. It is the only option
 *      that survives a custom domain, and the only one that stays stable
 *      across deployments.
 *   2. VERCEL_PROJECT_PRODUCTION_URL -- Vercel injects the project's stable
 *      production domain automatically, so production still works if someone
 *      forgets step 1.
 *   3. VERCEL_URL -- the per-deployment URL. Correct for preview deploys,
 *      where a stable domain doesn't exist. Not used for production because
 *      it changes on every deploy.
 *   4. localhost -- local development only.
 *
 * Both Vercel vars are supplied bare (`my-app.vercel.app`, no scheme), hence
 * the prefixing below.
 */
function resolveBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit;

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd}`;

  const vercelDeployment = process.env.VERCEL_URL;
  if (vercelDeployment) return `https://${vercelDeployment}`;

  return 'http://localhost:3000';
}

/** Base URL with any trailing slash removed, so callers can append paths. */
export function getAppUrl(): string {
  return resolveBaseUrl().replace(/\/+$/, '');
}

/** Absolute URL for `path` (which should start with "/"). */
export function appUrl(path: string): string {
  return `${getAppUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}
