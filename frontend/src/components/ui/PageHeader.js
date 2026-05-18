import React from 'react';
import { Box, Stack, Typography } from '@mui/material';

export default function PageHeader({ title, description, actions }) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', md: 'flex-start' }}
      spacing={{ xs: 2, md: 1.5 }}
      sx={{
        mb: { xs: 2.25, md: 3 },
        gap: { md: 2 },
      }}
    >
      <Box sx={{ flex: { md: '1 1 auto' }, minWidth: 0, maxWidth: { md: 'min(720px, 100%)' } }}>
        <Typography
          variant="h3"
          sx={{
            fontSize: { xs: '1.625rem', sm: '1.75rem', md: '2rem' },
            letterSpacing: { xs: '-0.025em', md: '-0.02em' },
            lineHeight: 1.12,
          }}
        >
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.9, maxWidth: '62ch' }}>
            {description}
          </Typography>
        )}
      </Box>
      {actions && (
        <Box
          sx={{
            width: { xs: '100%', md: 'auto' },
            flexShrink: 0,
            alignSelf: { xs: 'stretch', md: 'flex-start' },
            '& > .MuiStack-root': {
              width: '100%',
            },
          }}
        >
          {actions}
        </Box>
      )}
    </Stack>
  );
}
