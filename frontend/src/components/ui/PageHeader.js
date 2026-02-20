import React from 'react';
import { Stack, Typography } from '@mui/material';

export default function PageHeader({ title, description, actions }) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', md: 'center' }}
      spacing={1.5}
      sx={{ mb: 3 }}
    >
      <div>
        <Typography variant="h3">{title}</Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
            {description}
          </Typography>
        )}
      </div>
      {actions}
    </Stack>
  );
}
