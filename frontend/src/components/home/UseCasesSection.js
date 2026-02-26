import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Container,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import ArrowRightRoundedIcon from '@mui/icons-material/ArrowRightRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';

const useCases = [
  {
    icon: <PaymentsRoundedIcon />,
    title: 'Stablecoin Payouts & Payroll',
    bullets: [
      'Schedule recurring EGLD/ESDT/stablecoin payments',
      'Automate payroll across multiple wallets',
      'Trigger payouts from CRM or invoice tools',
    ],
  },
  {
    icon: <CardGiftcardRoundedIcon />,
    title: 'Bulk Airdrops',
    bullets: [
      'Airdrop tokens or NFTs to thousands of addresses',
      'CSV-driven distribution via Make.com',
      'Filter recipients by holding or activity',
    ],
  },
  {
    icon: <AccountBalanceRoundedIcon />,
    title: 'Treasury Rules',
    bullets: [
      'Rebalance treasury on schedule or trigger',
      'Distribute staking rewards automatically',
      'Enforce spending limits with approval flows',
    ],
  },
  {
    icon: <GroupsRoundedIcon />,
    title: 'DAO & Community Automation',
    bullets: [
      'Snapshot token holders (including staked)',
      'Run verifiable draws and raffles',
      'Reward top contributors based on on-chain data',
    ],
  },
  {
    icon: <ShowChartRoundedIcon />,
    title: 'DeFi Automation',
    bullets: [
      'Trigger swaps at price thresholds',
      'Automate portfolio rebalancing rules',
      'Monitor liquidity positions and act on changes',
    ],
  },
  {
    icon: <CodeRoundedIcon />,
    title: 'Smart Contract Ops via Warps',
    bullets: [
      'Query and execute contract endpoints visually',
      'Chain multi-step contract interactions',
      'Build no-code workflows around any SC',
    ],
  },
];

export default function UseCasesSection() {
  return (
    <Box id="use-cases" sx={{ py: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Typography variant="h2" sx={{ mb: 1, textAlign: 'center' }}>
          What You Can Automate
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 5, textAlign: 'center', maxWidth: 600, mx: 'auto' }}
        >
          From treasury ops to community engagement, MakeX handles on-chain
          automation so your team can focus on building.
        </Typography>

        <Grid container spacing={2.5}>
          {useCases.map((uc) => (
            <Grid key={uc.title} item xs={12} sm={6} lg={4}>
              <Card sx={{ height: '100%', '&:hover': { borderColor: 'primary.dark' } }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ color: 'primary.main', mb: 1.5 }}>{uc.icon}</Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {uc.title}
                  </Typography>
                  <List dense disablePadding>
                    {uc.bullets.map((b) => (
                      <ListItem key={b} disableGutters sx={{ py: 0.3 }}>
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          <ArrowRightRoundedIcon fontSize="small" color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={b}
                          primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
