import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Container,
  Stack,
  Button,
  Chip,
  Divider,
  Link,
} from '@mui/material';

const videoUrl =
  'https://coral-defiant-guineafowl-119.mypinata.cloud/ipfs/bafybeih32s3dpoz6tau772ts3lxoexzkc3z67zmkavwopo7rfrchf5eaha/MakeX_Presentation.mp4';

const toolkitItems = [
  {
    title: 'MultiversX Transfers',
    text: 'Bulk airdrops, payroll automation, and EGLD/ESDT/NFT operations at scale.',
  },
  {
    title: 'Snapshot & Draw',
    text: 'Wallet snapshots, community analytics, and transparent holder-based raffles.',
  },
  {
    title: 'Assets Manager',
    text: 'Issue tokens, mint and burn supply, and automate token role assignments.',
  },
  {
    title: 'xExchange Swap',
    text: 'Create DeFi automations for swap triggers and treasury rebalancing.',
  },
  {
    title: 'Warps',
    text: 'Turn smart contract endpoints into visual no-code Make.com modules.',
  },
];

const filters = [
  { name: 'address', desc: 'Matches sender OR receiver OR relayer for complete wallet activity.' },
  { name: 'token', desc: 'Filter by EGLD or a specific token identifier (ESDT).' },
  { name: 'function', desc: 'Trigger only for specific smart contract endpoint calls.' },
  { name: 'sender', desc: 'Track outgoing activity from selected wallets.' },
  { name: 'receiver', desc: 'Track incoming activity for treasury/deposit addresses.' },
];

const installLinks = [
  {
    name: 'MultiversX Transfers',
    description: 'Send EGLD, ESDT and NFTs',
    href: 'https://eu2.make.com/app/invite/db68efb5e85d04d711a632a3b2017b7d',
  },
  {
    name: 'Snapshot & Draw',
    description: 'Holder snapshots and raffles',
    href: 'https://eu2.make.com/app/invite/682839e9c23f1ba1aeb9925e16551466',
  },
  {
    name: 'Assets Manager',
    description: 'Issue, mint and burn tokens',
    href: 'https://www.make.com/en/hq/app-invitation/4663d084cfa02a4cfc8824724f4bfa6a',
  },
  {
    name: 'xExchange Swap',
    description: 'DEX swaps and liquidity automation',
    href: '',
  },
  {
    name: 'Warps',
    description: 'Smart contract interactions',
    href: 'https://eu2.make.com/app/invite/113f288efa442e5a2529b09e3dbe4339',
  },
];

export default function HomePage() {
  return (
    <Box>
      <Box
        sx={{
          width: '100%',
          background: 'radial-gradient(circle at 20% 10%, rgba(35,247,221,0.25), rgba(10,10,10,1) 55%)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          py: { xs: 5, md: 8 },
        }}
      >
        <Container maxWidth="xl">
          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
            <Grid item xs={12} lg={6}>
              <Stack spacing={2}>
                <Chip label="No-code automation for MultiversX" sx={{ width: 'fit-content' }} />
                <Typography variant="h2" sx={{ fontWeight: 800, lineHeight: 1.08, fontSize: { xs: '2rem', md: '3.2rem' } }}>
                  MakeX: The &quot;Zapier&quot; of MultiversX
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 680 }}>
                  Build, automate, and scale on blockchain without writing code. MakeX connects MultiversX
                  with 2,500+ Web2 apps inside Make.com.
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                  Use the Login button in the top-right navbar to connect your wallet and create
                  subscriptions.
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} lg={6}>
              <Box
                component="video"
                controls
                playsInline
                preload="metadata"
                sx={{
                  width: '100%',
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'rgba(35,247,221,0.35)',
                  backgroundColor: 'black',
                  boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
                }}
              >
                <source src={videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: { xs: 5, md: 7 } }}>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
          The Toolkit
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>
          Stop coding infrastructure. Start automating value.
        </Typography>
        <Grid container spacing={2.5}>
          {toolkitItems.map((item) => (
            <Grid key={item.title} item xs={12} md={6} lg={4}>
              <Card sx={{ height: '100%', border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.text}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Divider />

      <Container maxWidth="xl" sx={{ py: { xs: 5, md: 7 } }}>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
          Real-Time Data: MultiversX WebSocket Subscriptions
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Don&apos;t poll the blockchain. Let the blockchain notify you.
        </Typography>
        <Grid container spacing={2}>
          {filters.map((filter) => (
            <Grid key={filter.name} item xs={12} md={6} lg={4}>
              <Card sx={{ height: '100%', backgroundColor: 'background.paper' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {filter.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {filter.desc}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Divider />

      <Container maxWidth="xl" sx={{ py: { xs: 5, md: 7 } }}>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
          Build No-Code AI Agents
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Combine Make AI Agents with MakeX to create autonomous wallet-enabled assistants.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Portfolio and Treasury Automation
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Build agents that monitor market data, execute xExchange swaps, and maintain target
                  treasury allocations.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Community and On-Chain Operations
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Reward contributors, run NFT-based campaigns, and execute advanced smart contract flows
                  using natural-language logic.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      <Divider />

      <Container maxWidth="xl" sx={{ py: { xs: 5, md: 7 } }}>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
          Install the MakeX Apps
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Install the custom modules directly into your Make.com organization.
        </Typography>
        <Grid container spacing={2}>
          {installLinks.map((item) => (
            <Grid key={item.name} item xs={12} md={6} lg={4}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <CardContent>
                  <Typography variant="h6">{item.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.2, mb: 2.2 }}>
                    {item.description}
                  </Typography>
                  {item.href ? (
                    <Button variant="contained" component={Link} href={item.href} target="_blank" rel="noreferrer">
                      Install Module
                    </Button>
                  ) : (
                    <Button variant="outlined" disabled>
                      Coming Soon
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          MakeX is a product of the HODL Token Club.
        </Typography>
      </Container>
    </Box>
  );
}
