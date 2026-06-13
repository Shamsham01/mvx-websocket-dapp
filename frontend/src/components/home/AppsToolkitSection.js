import React from 'react';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { APP_LOGOS } from '../../constants/links';

const apps = [
  {
    name: 'MultiversX Transfers',
    logo: APP_LOGOS.TRANSFERS,
    purpose: 'Send EGLD, ESDTs, stablecoins, NFTs, and SFTs\u00A0\u2014 individually or in bulk.',
    users: 'Projects, DAOs, payroll teams',
    usageFee: true,
    capabilities: [
      'Single & multi-recipient transfers',
      'Stablecoin payouts & payroll',
      'Bulk NFT/SFT distribution',
      'CSV-driven airdrops',
    ],
  },
  {
    name: 'Snapshot & Draw',
    logo: APP_LOGOS.SNAPSHOT_DRAW,
    purpose: 'Snapshot token holders (including staked) and run verifiable draws.',
    users: 'Communities, marketing teams, DAOs',
    usageFee: true,
    capabilities: [
      'Point-in-time holder snapshots',
      'Staking-aware balances',
      'Verifiable random draws',
      'Raffle automation',
    ],
  },
  {
    name: 'Assets Manager',
    logo: APP_LOGOS.ASSETS_MANAGER,
    purpose: 'Issue, mint, burn, and manage ESDT token lifecycle operations.',
    users: 'Token issuers, project teams',
    usageFee: true,
    capabilities: [
      'Issue new tokens',
      'Mint & burn supply',
      'Manage token roles',
      'Lifecycle operations',
    ],
  },
  {
    name: 'Warps',
    logo: APP_LOGOS.WARPS,
    purpose: 'Query and execute any smart contract endpoint visually, no code required.',
    users: 'Non-devs, DAOs, ops teams',
    usageFee: true,
    capabilities: [
      'Visual SC endpoint execution',
      'Query contract state',
      'Chain multi-step interactions',
      'No-code contract ops',
    ],
  },
  {
    name: 'MultiversX Swap',
    logo: APP_LOGOS.MULTIVERSX_SWAP,
    purpose: 'Automated token swaps using AshSwap Aggregator',
    users: 'Traders, treasury managers, DeFi teams',
    usageFee: true,
    capabilities: [
      'Automated swap triggers',
      'AshSwap Aggregator routing',
      'Portfolio & treasury flows',
      'DeFi strategy automation',
    ],
  },
  {
    name: 'Twitter / X',
    logo: APP_LOGOS.TWITTER_X,
    purpose:
      'Create X posts with images and video, and search or retrieve posts and accounts — all from Make.com.',
    users: 'Marketing teams, community managers',
    usageFee: true,
    capabilities: [
      'Posts with images & video',
      'Search posts & accounts',
      'Social automation',
      'Usage fee required',
    ],
  },
  {
    name: 'MultiversX API',
    logo: APP_LOGOS.MULTIVERSX_API,
    purpose:
      'Build MultiversX apps and integrations with ease — 171 REST endpoints, no custom code required.',
    users: 'Developers, analysts, automation builders',
    alwaysFree: true,
    capabilities: [
      '171 REST endpoints',
      'Apps & integrations',
      'Accounts, tokens & network data',
      'Always free to use',
    ],
  },
  {
    name: 'MultiversX Data API',
    logo: APP_LOGOS.MULTIVERSX_DATA_API,
    purpose:
      'Access current and historical token prices plus rich on-chain token data for dashboards and automations.',
    users: 'Analysts, dashboards, reporting flows',
    alwaysFree: true,
    capabilities: [
      'Live & historical prices',
      'Token & market data',
      'Reporting & dashboards',
      'Always free to use',
    ],
  },
];

export default function AppsToolkitSection() {
  return (
    <Box id="apps" sx={{ py: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Typography variant="h2" sx={{ mb: 1, textAlign: 'center' }}>
          Apps & Toolkit
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 5, textAlign: 'center', maxWidth: 600, mx: 'auto' }}
        >
          Eight purpose-built Make.com modules that cover on-chain operations,
          public API access, and social automation.
        </Typography>

        <Grid container spacing={2.5}>
          {apps.map((app) => (
            <Grid key={app.name} item xs={12} sm={6} lg={4}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  '&:hover': { borderColor: 'primary.dark' },
                }}
              >
                <CardContent
                  sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <Avatar
                      src={app.logo}
                      alt={app.name}
                      variant="rounded"
                      sx={{ width: 52, height: 52 }}
                    />
                    <Box>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                          {app.name}
                        </Typography>
                        {app.alwaysFree ? (
                          <Chip
                            label="Always free"
                            size="small"
                            color="success"
                            sx={{ fontSize: '0.65rem', height: 20 }}
                          />
                        ) : null}
                        {app.usageFee ? (
                          <Chip
                            label="Usage fee"
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.65rem', height: 20 }}
                          />
                        ) : null}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {app.users}
                      </Typography>
                    </Box>
                  </Stack>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {app.purpose}
                  </Typography>

                  <Stack
                    direction="row"
                    spacing={0.5}
                    flexWrap="wrap"
                    useFlexGap
                  >
                    {app.capabilities.map((c) => (
                      <Chip
                        key={c}
                        label={c}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
