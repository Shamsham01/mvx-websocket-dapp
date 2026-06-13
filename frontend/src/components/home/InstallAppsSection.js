import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { APP_LOGOS, INSTALL_URLS } from '../../constants/links';

const APP_LOGO_AVATAR_SX = { width: 52, height: 52 };

const apps = [
  {
    name: 'MultiversX Transfers',
    logo: APP_LOGOS.TRANSFERS,
    purpose: 'EGLD, ESDT, NFT & SFT transfers \u2014 single or bulk',
    installUrl: INSTALL_URLS.TRANSFERS,
    usageFee: true,
  },
  {
    name: 'Snapshot & Draw',
    logo: APP_LOGOS.SNAPSHOT_DRAW,
    purpose: 'Holder snapshots and verifiable draws',
    installUrl: INSTALL_URLS.SNAPSHOT_DRAW,
    usageFee: true,
  },
  {
    name: 'Assets Manager',
    logo: APP_LOGOS.ASSETS_MANAGER,
    purpose: 'Issue, mint, burn, and manage token lifecycle',
    installUrl: INSTALL_URLS.ASSETS_MANAGER,
    usageFee: true,
  },
  {
    name: 'Warps',
    logo: APP_LOGOS.WARPS,
    purpose: 'Query and execute smart contract endpoints visually',
    installUrl: INSTALL_URLS.WARPS,
    usageFee: true,
  },
  {
    name: 'MultiversX Swap',
    logo: APP_LOGOS.MULTIVERSX_SWAP,
    purpose: 'Automated token swaps using AshSwap Aggregator',
    installUrl: INSTALL_URLS.MULTIVERSX_SWAP,
    usageFee: true,
  },
  {
    name: 'Twitter / X',
    logo: APP_LOGOS.TWITTER_X,
    purpose:
      'Create X posts with images and video, and search or retrieve posts and accounts.',
    installUrl: INSTALL_URLS.TWITTER_X,
    usageFee: true,
  },
  {
    name: 'MultiversX API',
    logo: APP_LOGOS.MULTIVERSX_API,
    purpose: 'Build MultiversX apps and integrations with ease — 171 endpoints available.',
    installUrl: INSTALL_URLS.MULTIVERSX_API,
    alwaysFree: true,
  },
  {
    name: 'MultiversX Data API',
    logo: APP_LOGOS.MULTIVERSX_DATA_API,
    purpose: 'Current and historical token prices plus on-chain token data for your workflows.',
    installUrl: INSTALL_URLS.MULTIVERSX_DATA_API,
    alwaysFree: true,
  },
];

function AppNameCell({ app }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Avatar
        src={app.logo}
        alt={app.name}
        variant="rounded"
        sx={APP_LOGO_AVATAR_SX}
      />
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {app.name}
          </Typography>
          {app.alwaysFree ? (
            <Chip label="Always free" size="small" color="success" sx={{ fontSize: '0.65rem', height: 20 }} />
          ) : null}
          {app.usageFee ? (
            <Chip label="Usage fee" size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
          ) : null}
        </Stack>
      </Stack>
    </Stack>
  );
}

function InstallButton({ app, fullWidth = false }) {
  if (!app.installUrl) {
    return (
      <Button variant="outlined" size="small" disabled fullWidth={fullWidth}>
        Coming soon
      </Button>
    );
  }

  return (
    <Button
      variant="outlined"
      size="small"
      endIcon={<OpenInNewRoundedIcon />}
      href={app.installUrl}
      target="_blank"
      rel="noopener noreferrer"
      fullWidth={fullWidth}
    >
      Install
    </Button>
  );
}

export default function InstallAppsSection() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <Box id="install" sx={{ py: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Typography variant="h2" sx={{ mb: 1, textAlign: 'center' }}>
          Install Apps
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 4, textAlign: 'center' }}
        >
          Add MakeX modules to your Make.com workspace in one click.
        </Typography>

        {isDesktop ? (
          <TableContainer component={Card}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>App</TableCell>
                  <TableCell>Purpose</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {apps.map((app) => (
                  <TableRow key={app.name}>
                    <TableCell>
                      <AppNameCell app={app} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {app.purpose}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <InstallButton app={app} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Stack spacing={2}>
            {apps.map((app) => (
              <Card key={app.name}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ mb: 1.5 }}>
                    <AppNameCell app={app} />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {app.purpose}
                  </Typography>
                  <InstallButton app={app} fullWidth />
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', textAlign: 'center', mt: 2 }}
        >
          Install each app directly into your Make.com workspace.
        </Typography>
      </Container>
    </Box>
  );
}
