import React from 'react';
import { Card, CardContent, Stack, Typography } from '@mui/material';

export default function SectionCard({ title, description, action, children, sx }) {
  return (
    <Card sx={{ ...sx }}>
      <CardContent sx={{ p: 3 }}>
        {(title || action) && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            spacing={1.25}
            sx={{ mb: children ? 2 : 0 }}
          >
            <div>
              {title && <Typography variant="h5">{title}</Typography>}
              {description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                  {description}
                </Typography>
              )}
            </div>
            {action}
          </Stack>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
