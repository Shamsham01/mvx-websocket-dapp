import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { APP_LOGOS, INSTALL_URLS } from '../../constants/links';

const apps = [
  {
    name: 'MultiversX Transfers',
    logo: APP_LOGOS.TRANSFERS,
    purpose: 'Send EGLD, ESDTs, stablecoins, NFTs, and SFTs\u00A0\u2014 individually or in bulk.',
    users: 'Projects, DAOs, payroll teams',
    capabilities: [
      'Single & multi-recipient transfers',
      'Stablecoin payouts & payroll',
      'Bulk NFT/SFT distribution',
      'CSV-driven airdrops',
    ],
    installUrl: INSTALL_URLS.TRANSFERS,
  },
  {
    name: 'Snapshot & Draw',
    logo: APP_LOGOS.SNAPSHOT_DRAW,
    purpose: 'Snapshot token holders (including staked) and run verifiable draws.',
    users: 'Communities, marketing teams, DAOs',
    capabilities: [
      'Point-in-time holder snapshots',
      'Staking-aware balances',
      'Verifiable random draws',
      'Raffle automation',
    ],
    installUrl: INSTALL_URLS.SNAPSHOT_DRAW,
  },
  {
    name: 'Assets Manager',
    logo: APP_LOGOS.ASSETS_MANAGER,
    purpose: 'Issue, mint, burn, and manage ESDT token lifecycle operations.',
    users: 'Token issuers, project teams',
    capabilities: [
      'Issue new tokens',
      'Mint & burn supply',
      'Manage token roles',
      'Lifecycle operations',
    ],
    installUrl: INSTALL_URLS.ASSETS_MANAGER,
  },
  {
    name: 'Warps',
    logo: APP_LOGOS.WARPS,
    purpose: 'Query and execute any smart contract endpoint visually, no code required.',
    users: 'Non-devs, DAOs, ops teams',
    capabilities: [
      'Visual SC endpoint execution',
      'Query contract state',
      'Chain multi-step interactions',
      'No-code contract ops',
    ],
    installUrl: INSTALL_URLS.WARPS,
  },
  {
    name: 'xExchange Swap',
    logo: null,
    purpose: 'Trigger token swaps on xExchange with automation rules.',
    users: 'Traders, treasury managers, DeFi teams',
    capabilities: [
      'Automated swap triggers',
      'Price-threshold execution',
      'Portfolio rebalancing',
      'DeFi strategy automation',
    ],
    installUrl: INSTALL_URLS.XEXCHANGE_SWAP,
    comingSoon: true,
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
          Five purpose-built Make.com modules that cover the full spectrum of
          on-chain operations.
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
                    {app.logo ? (
                      <Avatar
                        src={app.logo}
                        alt={app.name}
                        variant="rounded"
                        sx={{ width: 44, height: 44 }}
                      />
                    ) : (
                      <Avatar
                        variant="rounded"
                        sx={{ width: 44, height: 44, bgcolor: 'primary.dark' }}
                      >
                        <SwapHorizRoundedIcon />
                      </Avatar>
                    )}
                    <Box>
                      <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                        {app.name}
                      </Typography>
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
                    sx={{ mb: 2 }}
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

                  <Box sx={{ mt: 'auto' }}>
                    {app.comingSoon ? (
                      <Button variant="outlined" size="small" disabled fullWidth>
                        Coming Soon
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        size="small"
                        endIcon={<OpenInNewRoundedIcon />}
                        href={app.installUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        fullWidth
                      >
                        Install on Make.com
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
