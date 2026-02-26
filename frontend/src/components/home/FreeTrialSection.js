import React from 'react';
import { Box, Button, Card, CardContent, Container, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useAuth } from '../../context/AuthContext';
import { openWalletConnect } from '../../utils/walletConnect';

export default function FreeTrialSection({ onOpenTrial }) {
  const { user } = useAuth();

  const handleClick = () => {
    if (!user) {
      openWalletConnect();
      return;
    }
    onOpenTrial?.();
  };

  return (
    <Box
      id="free-trial"
      sx={{
        py: { xs: 6, md: 8 },
        borderTop: (t) => `1px solid ${t.palette.divider}`,
        background: (t) => alpha(t.palette.background.paper, 0.3),
      }}
    >
      <Container maxWidth="sm">
        <Card
          sx={{
            textAlign: 'center',
            background: (t) =>
              `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.08)}, ${alpha(t.palette.secondary.main, 0.08)})`,
            border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.2)}`,
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="h3" sx={{ mb: 1.5 }}>
              Free Trial + $REWARD
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              30 days fee-free to test every MakeX app.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              After the trial, operations are powered by $REWARD with micro-fees
              (~$0.03/action). No subscriptions, no hidden costs.
            </Typography>
            <Button variant="contained" size="large" onClick={handleClick}>
              Claim Free Trial
            </Button>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
