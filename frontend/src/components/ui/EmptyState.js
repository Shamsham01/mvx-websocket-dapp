import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';

export default function EmptyState({ title, description, actionLabel, onAction, icon }) {
  return (
    <Stack
      spacing={1.2}
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      sx={{
        py: 8,
        px: 2,
        border: '1px dashed rgba(148, 163, 184, 0.28)',
        borderRadius: 3,
        backgroundColor: 'rgba(15, 23, 42, 0.32)',
      }}
    >
      {icon && <Box sx={{ color: 'primary.main', mb: 0.5 }}>{icon}</Box>}
      <Typography variant="h5">{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>
        {description}
      </Typography>
      {actionLabel && onAction && (
        <Button variant="contained" onClick={onAction} sx={{ mt: 1 }}>
          {actionLabel}
        </Button>
      )}
    </Stack>
  );
}
