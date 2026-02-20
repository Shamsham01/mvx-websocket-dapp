import React from 'react';
import { IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

function truncate(value, max = 40) {
  if (!value) return '-';
  if (value.length <= max) return value;
  return `${value.slice(0, max - 8)}...${value.slice(-5)}`;
}

export default function CopyableField({ value, label, mono = true, onCopy }) {
  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      if (onCopy) onCopy();
    } catch (_) {
      // Browser clipboard may fail silently in restricted contexts.
    }
  };

  return (
    <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0 }}>
      <Tooltip title={value || ''} placement="top">
        <Typography
          variant="body2"
          sx={{
            minWidth: 0,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace' : 'inherit',
          }}
        >
          {label ? `${label}: ${truncate(value)}` : truncate(value)}
        </Typography>
      </Tooltip>
      <IconButton size="small" onClick={handleCopy} aria-label="Copy value" disabled={!value}>
        <ContentCopyIcon fontSize="inherit" />
      </IconButton>
    </Stack>
  );
}
