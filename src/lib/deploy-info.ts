// The branch and commit deployed to dev (ADR 0008), shown in the page footer
// so whoever opens dev knows what they are looking at. deploy-dev.yml passes
// them with `wrangler deploy --var`; no other environment shows them.

export interface DeployInfo {
  branch: string;
  /** The full commit SHA. */
  commit: string;
  /** The first seven characters, as GitHub shows it. */
  shortCommit: string;
}

export function readDeployInfo(vars: {
  ENVIRONMENT?: string | undefined;
  DEPLOY_BRANCH?: string | undefined;
  DEPLOY_COMMIT?: string | undefined;
}): DeployInfo | undefined {
  if (vars.ENVIRONMENT !== "dev") return undefined;
  const branch = vars.DEPLOY_BRANCH?.trim() ?? "";
  const commit = vars.DEPLOY_COMMIT?.trim().toLowerCase() ?? "";
  if (branch === "" || !/^[0-9a-f]{7,64}$/.test(commit)) return undefined;
  return { branch, commit, shortCommit: commit.slice(0, 7) };
}
