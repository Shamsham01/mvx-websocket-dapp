/** Marketplace category presets (stored as-is in DB). "Custom" in the UI saves a free-text label. */
export const TEMPLATE_LABEL_PRESETS = [
  'Snapshots',
  'Draws',
  'Transfers',
  'Warps',
  'Assets Manager',
  'Swaps',
];

export const TEMPLATE_CUSTOM_LABEL_VALUE = 'CUSTOM';

/** Filter bar: all templates, one preset, or any non-preset label bucket */
export const TEMPLATE_FILTER_ALL = 'all';
export const TEMPLATE_FILTER_OTHER = '__other__';

const PRESET_SET = new Set(TEMPLATE_LABEL_PRESETS);

export function isPresetLabel(label) {
  return Boolean(label && PRESET_SET.has(label));
}
