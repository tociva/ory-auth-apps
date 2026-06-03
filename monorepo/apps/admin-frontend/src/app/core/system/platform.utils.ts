export const isMacPlatform = (): boolean => {
  const nav = globalThis.navigator;
  if (!nav) {
    return false;
  }

  const userAgentDataPlatform = (nav as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData?.platform;
  return userAgentDataPlatform === "macOS" || /Mac|iPhone|iPad|iPod/.test(nav.platform);
};
