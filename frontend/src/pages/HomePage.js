import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import KeyboardDoubleArrowRightRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowRightRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import { Link as RouterLink } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';

const highlights = [
  { icon: <HubRoundedIcon color="primary" />, title: 'MultiversX Events', text: 'Capture transactions in real time from mainnet, testnet, or devnet.' },
  { icon: <InsightsRoundedIcon color="secondary" />, title: 'Webhook Reliability', text: 'Subscribe to address, token, sender, receiver, and function-level activity.' },
  { icon: <BoltRoundedIcon color="success" />, title: 'No-Code Automation', text: 'Connect blockchain events to Make.com flows for immediate business actions.' },
];

const onboardingSteps = [
  'Connect your wallet from the top bar.',
  'Create a subscription with at least one filter.',
  'Point events to your webhook endpoint and test deliveries.',
  'Monitor and update subscriptions from the dashboard.',
];

export default function HomePage() {
  return (
    <Box>
      <PageHeader
        title="MultiversX WebSocket Dashboard"
        description="Professional event automation for wallets, contracts, and token flows."
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="contained" component={RouterLink} to="/subscriptions/new">
              Create Subscription
            </Button>
            <Button variant="outlined" component={RouterLink} to="/dashboard">
              Open Dashboard
            </Button>
          </Stack>
        }
      />

      <SectionCard
        sx={{ mb: 3 }}
        title="Launch Faster with MakeX"
        description="Use one control center for onboarding, monitoring, and managing webhook automation."
      >
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label="Wallet Native Auth" color="primary" />
          <Chip label="Webhook Subscriptions" color="secondary" />
          <Chip label="Mainnet / Testnet / Devnet" />
          <Chip label="Real-time Events" color="success" />
        </Stack>
      </SectionCard>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {highlights.map((item) => (
          <Grid key={item.title} item xs={12} md={4}>
            <SectionCard title={item.title}>
              <Stack spacing={1.2}>
                {item.icon}
                <Typography variant="body2" color="text.secondary">
                  {item.text}
                </Typography>
              </Stack>
            </SectionCard>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={7}>
          <SectionCard
            title="Onboarding Checklist"
            description="A quick path from wallet connection to active webhook delivery."
          >
            <List dense disablePadding>
              {onboardingSteps.map((step) => (
                <ListItem key={step} disableGutters sx={{ py: 0.8 }}>
                  <ListItemIcon sx={{ minWidth: 30 }}>
                    <KeyboardDoubleArrowRightRoundedIcon fontSize="small" color="primary" />
                  </ListItemIcon>
                  <ListItemText primary={step} />
                </ListItem>
              ))}
            </List>
          </SectionCard>
        </Grid>
        <Grid item xs={12} lg={5}>
          <SectionCard title="Product Note">
            <Alert
              severity="info"
              icon={<RocketLaunchRoundedIcon fontSize="inherit" />}
              sx={{ borderColor: 'rgba(70, 217, 255, 0.3)' }}
            >
              This dashboard keeps Web3 workflows clear and predictable. For best reliability, start with one
              focused subscription per webhook endpoint, then scale by use case.
            </Alert>
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}
