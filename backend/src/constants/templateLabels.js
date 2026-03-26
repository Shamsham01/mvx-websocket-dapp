const PRESET_LABELS = [
  'Snapshots',
  'Draws',
  'Transfers',
  'Warps',
  'Assets Manager',
  'Swaps',
];

const PRESET_SET = new Set(PRESET_LABELS);

const MAX_LEN = 120;

function parseTemplateLabel(body) {
  const raw = String(body?.label ?? '').trim();
  if (!raw) {
    return { error: 'Label is required' };
  }
  if (raw.length > MAX_LEN) {
    return { error: `Label must be at most ${MAX_LEN} characters` };
  }
  return { label: raw };
}

module.exports = {
  PRESET_LABELS,
  PRESET_SET,
  parseTemplateLabel,
};
