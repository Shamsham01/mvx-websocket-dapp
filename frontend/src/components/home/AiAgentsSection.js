import React from 'react';
import {
  Box,
  Button,
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
import { alpha } from '@mui/material/styles';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import ArrowRightRoundedIcon from '@mui/icons-material/ArrowRightRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { DOCS } from '../../constants/links';

const agentUseCases = [
  'Portfolio monitoring with automated swap execution',
  'Treasury balancing rules triggered by market conditions',
  'Community rewards distributed based on Discord or X signals',
  'On-chain task automation via Warps endpoints',
];

export default function AiAgentsSection() {
  return (
    <Box sx={{ py: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h2" sx={{ mb: 1.5 }}>
              AI Agents + MakeX
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Combine Make.com AI Agents with MakeX to create wallet-equipped
              assistants that act on-chain autonomously via no-code automation.
            </Typography>
            <List dense disablePadding>
              {agentUseCases.map((uc) => (
                <ListItem key={uc} disableGutters sx={{ py: 0.4 }}>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <ArrowRightRoundedIcon fontSize="small" color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={uc}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              ))}
            </List>
            <Button
              variant="outlined"
              endIcon={<OpenInNewRoundedIcon />}
              href={DOCS.MAKE_AI_AGENTS}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ mt: 2 }}
            >
              Explore Make AI Agents
            </Button>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3, textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                    background: (t) =>
                      `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.15)}, ${alpha(t.palette.secondary.main, 0.15)})`,
                  }}
                >
                  <SmartToyRoundedIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                </Box>
                <Typography variant="h5" sx={{ mb: 1 }}>
                  Agentic Workflows
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  AI agents with wallets that monitor, decide, and act on-chain
                  — powered by Make.com scenarios and MakeX modules.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
