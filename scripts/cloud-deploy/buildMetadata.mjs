/** Build metadata baked into C1 images via Docker build-args (see Dockerfile). */

/**
 * @param {string} packageVersion
 * @returns {{ version: string; gitSha: string; imageTag: string; builtAt: string | null }}
 */
export function readBuildMetadata(packageVersion) {
  const gitSha = process.env.ADV_BUILD_GIT_SHA?.trim() || "dev";
  const imageTag = process.env.ADV_BUILD_IMAGE_TAG?.trim() || gitSha;
  const builtAt = process.env.ADV_BUILD_TIME?.trim() || null;
  return { version: packageVersion, gitSha, imageTag, builtAt };
}
