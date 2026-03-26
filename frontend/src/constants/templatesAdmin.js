/** Must match backend `MAKEX_TEMPLATES_ADMIN_WALLET` (used for UI only; server enforces). */
export const MAKEX_TEMPLATES_ADMIN_ADDRESS =
  'erd1h9hm0gnkgn888ly9zgnswsjajprk2fkszndwhm28xkcay66xnnesdyzcs6';

export function isTemplatesAdmin(address) {
  return Boolean(address && address === MAKEX_TEMPLATES_ADMIN_ADDRESS);
}
