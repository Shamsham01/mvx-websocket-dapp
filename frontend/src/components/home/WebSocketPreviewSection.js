import React from 'react';
import { Box, Button, Card, CardContent, Container, Grid, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import WebhookRoundedIcon from '@mui/icons-material/WebhookRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import { Link as RouterLink } from 'react-router-dom';

const steps = [
  {
    icon: <WebhookRoundedIcon />,
    title: 'Create a Make.com Webhook',
    description: 'Set up a webhook URL in any Make.com scenario to receive blockchain events.',
  },
  {
    icon: <TuneRoundedIcon />,
    title: 'Configure Filters',
    description:
      'Filter by sender, receiver, token, function, or address to get only relevant events.',
  },
  {
    icon: <NotificationsActiveRoundedIcon />,
    title: 'Receive Events Instantly',
    description:
      'On-chain events are pushed to your webhook the moment they occur. No polling needed.',
  },
];

export default function WebSocketPreviewSection() {
  return (
    <Box
      id="websocket"
      sx={{
        py: { xs: 6, md: 8 },
        borderTop: (t) => `1px solid ${t.palette.divider}`,
        background: (t) => alpha(t.palette.background.paper, 0.3),
      }}
    >
      <Container maxWidth="lg">
        <Typography variant="h2" sx={{ mb: 1, textAlign: 'center' }}>
          Real-Time Triggers
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 5, textAlign: 'center', maxWidth: 560, mx: 'auto' }}
        >
          {`Don\u2019t poll; receive on-chain events instantly via WebSocket subscriptions.`}
        </Typography>

        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {steps.map((step, i) => (
            <Grid key={step.title} item xs={12} md={4}>
              <Card sx={{ height: '100%', textAlign: 'center' }}>
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2,
                      background: (t) => alpha(t.palette.primary.main, 0.12),
                      color: 'primary.main',
                    }}
                  >
                    {step.icon}
                  </Box>
                  <Typography
                    variant="caption"
                    color="primary.main"
                    sx={{ fontWeight: 700, display: 'block' }}
                  >
                    Step {i + 1}
                  </Typography>
                  <Typography variant="h6" sx={{ mb: 1, mt: 0.5 }}>
                    {step.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {step.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ textAlign: 'center' }}>
          <Button variant="contained" component={RouterLink} to="/subscriptions">
            Create a Subscription
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
