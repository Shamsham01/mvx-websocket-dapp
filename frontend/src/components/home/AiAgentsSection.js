import React from 'react';
import {
  Box,
  Button,
  Container,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ArrowRightRoundedIcon from '@mui/icons-material/ArrowRightRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { DOCS, MEDIA } from '../../constants/links';

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
            <Typography
              variant="h2"
              sx={{
                mb: 1.5,
                textAlign: { xs: 'center', md: 'left' },
              }}
            >
              AI Agents + MakeX
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                mb: 3,
                maxWidth: { xs: '40ch', md: 'none' },
                mx: { xs: 'auto', md: 0 },
                textAlign: { xs: 'center', md: 'left' },
              }}
            >
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
            <Box
              sx={{
                borderRadius: 2,
                overflow: 'hidden',
                border: (t) => `1px solid ${alpha(t.palette.divider, 0.4)}`,
                bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                boxShadow: (t) =>
                  t.palette.mode === 'dark'
                    ? `0 8px 32px ${alpha('#000', 0.35)}`
                    : `0 8px 24px ${alpha('#000', 0.08)}`,
              }}
            >
              <Box
                component="img"
                src={MEDIA.AI_AGENTS_ILLUSTRATION}
                alt="Traditional agents compared to agentic workflows with MakeX on-chain automation"
                sx={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: { xs: 300, sm: 360, md: 440 },
                  width: 'auto',
                  height: 'auto',
                  mx: 'auto',
                }}
              />
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
