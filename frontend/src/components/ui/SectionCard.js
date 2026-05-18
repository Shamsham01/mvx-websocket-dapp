import React from 'react';
import { Box, Card, CardContent, Stack, Typography } from '@mui/material';

export default function SectionCard({ title, description, action, children, sx }) {
  return (
    <Card sx={{ overflow: 'hidden', ...sx }}>
      <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
        {(title || action) && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
            justifyContent="space-between"
            spacing={1.25}
            sx={{ mb: children ? { xs: 1.75, sm: 2 } : 0, gap: 1 }}
          >
            <Box sx={{ minWidth: 0, flex: { sm: '1 1 auto' } }}>
              {title && (
                <Typography variant="h5" sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
                  {title}
                </Typography>
              )}
              {description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.45, maxWidth: '72ch' }}>
                  {description}
                </Typography>
              )}
            </Box>
            {action && (
              <Box
                sx={{
                  width: { xs: '100%', sm: 'auto' },
                  alignSelf: { xs: 'stretch', sm: 'flex-start' },
                  maxWidth: '100%',
                  overflowX: { xs: 'auto', sm: 'visible' },
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: { xs: 'thin', sm: 'none' },
                  pb: { xs: 0.25, sm: 0 },
                }}
              >
                {action}
              </Box>
            )}
          </Stack>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
