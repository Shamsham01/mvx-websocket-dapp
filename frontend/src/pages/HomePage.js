import React from 'react';
import { Box, Typography, Grid, Card, CardContent, Divider } from '@mui/material';

const toolkitItems = [
  {
    title: 'MultiversX Transfers',
    description: 'Automate bulk airdrops, payroll, and day-to-day EGLD/ESDT distributions.',
  },
  {
    title: 'Snapshot & Draw',
    description: 'Run holder snapshots, analytics, and verifiable community raffles.',
  },
  {
    title: 'Assets Manager',
    description: 'Issue tokens, mint/burn supply, and manage asset roles with no code.',
  },
  {
    title: 'xExchange Swap',
    description: 'Build automated swap and treasury rebalancing workflows on the DEX.',
  },
  {
    title: 'Warps',
    description: 'Connect smart contract endpoints directly into visual Make.com scenarios.',
  },
];

export default function HomePage() {
  return (
    <Box>
      <Box sx={{ mb: 5 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1.5 }}>
          MakeX: The "Zapier" of MultiversX
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 3, maxWidth: 900 }}>
          Build, automate, and scale on blockchain without writing code. MakeX connects MultiversX to
          2,500+ Web2 apps so complex on-chain actions become drag-and-drop workflows.
        </Typography>
        <Box
          component="video"
          controls
          playsInline
          preload="metadata"
          sx={{
            width: '100%',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'black',
            maxHeight: 560,
          }}
        >
          <source
            src="https://coral-defiant-guineafowl-119.mypinata.cloud/ipfs/bafybeih32s3dpoz6tau772ts3lxoexzkc3z67zmkavwopo7rfrchf5eaha/MakeX_Presentation.mp4"
            type="video/mp4"
          />
          Your browser does not support the video tag.
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Box sx={{ mb: 5 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1.5 }}>
          The Toolkit
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Stop coding infrastructure. Start automating value.
        </Typography>
        <Grid container spacing={2}>
          {toolkitItems.map((item) => (
            <Grid key={item.title} item xs={12} md={6} lg={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1.5 }}>
          Real-Time MultiversX WebSocket Subscriptions
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 1 }}>
          Don&apos;t poll the blockchain. Let the blockchain notify you.
        </Typography>
        <Typography variant="body1" sx={{ mb: 1 }}>
          Create Make.com webhooks, configure `subscribeCustomTransfers`, and stream transactions, SCRs,
          and rewards in real-time using filters like address, token, function, sender, and receiver.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Use the Login button in the top-right navbar to connect your wallet and start creating
          subscriptions.
        </Typography>
      </Box>
    </Box>
  );
}
