import React from 'react';
import { Card, CardContent, Stack, Typography } from '@mui/material';

export default function StatCard({ label, value, caption, icon }) {
  return (
    <Card
      sx={{
        height: '100%',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: 4,
          borderColor: 'rgba(70, 217, 255, 0.25)',
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          {icon}
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Stack>
        <Typography variant="h3" sx={{ lineHeight: 1.1 }}>
          {value}
        </Typography>
        {caption && (
          <Typography variant="caption" sx={{ mt: 0.8, display: 'block' }}>
            {caption}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
