import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
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
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { APP_LOGOS, INSTALL_URLS } from '../../constants/links';

const apps = [
  {
    name: 'MultiversX Transfers',
    logo: APP_LOGOS.TRANSFERS,
    purpose: 'EGLD, ESDT, NFT & SFT transfers \u2014 single or bulk',
    installUrl: INSTALL_URLS.TRANSFERS,
  },
  {
    name: 'Snapshot & Draw',
    logo: APP_LOGOS.SNAPSHOT_DRAW,
    purpose: 'Holder snapshots and verifiable draws',
    installUrl: INSTALL_URLS.SNAPSHOT_DRAW,
  },
  {
    name: 'Assets Manager',
    logo: APP_LOGOS.ASSETS_MANAGER,
    purpose: 'Issue, mint, burn, and manage token lifecycle',
    installUrl: INSTALL_URLS.ASSETS_MANAGER,
  },
  {
    name: 'Warps',
    logo: APP_LOGOS.WARPS,
    purpose: 'Query and execute smart contract endpoints visually',
    installUrl: INSTALL_URLS.WARPS,
  },
  {
    name: 'xExchange Swap',
    logo: null,
    purpose: 'Automated token swaps on xExchange',
    installUrl: INSTALL_URLS.XEXCHANGE_SWAP,
    comingSoon: true,
  },
];

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
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        {app.logo ? (
                          <Avatar
                            src={app.logo}
                            alt={app.name}
                            variant="rounded"
                            sx={{ width: 36, height: 36 }}
                          />
                        ) : (
                          <Avatar
                            variant="rounded"
                            sx={{ width: 36, height: 36, bgcolor: 'primary.dark' }}
                          >
                            <SwapHorizRoundedIcon fontSize="small" />
                          </Avatar>
                        )}
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {app.name}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {app.purpose}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {app.comingSoon ? (
                        <Button variant="outlined" size="small" disabled>
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
                        >
                          Install
                        </Button>
                      )}
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
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                    {app.logo ? (
                      <Avatar
                        src={app.logo}
                        alt={app.name}
                        variant="rounded"
                        sx={{ width: 36, height: 36 }}
                      />
                    ) : (
                      <Avatar
                        variant="rounded"
                        sx={{ width: 36, height: 36, bgcolor: 'primary.dark' }}
                      >
                        <SwapHorizRoundedIcon fontSize="small" />
                      </Avatar>
                    )}
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {app.name}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {app.purpose}
                  </Typography>
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
                      Install
                    </Button>
                  )}
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
