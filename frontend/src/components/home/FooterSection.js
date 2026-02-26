import React from 'react';
import { Box, Container, Divider, Grid, Link, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { COMMUNITY, DOCS, MEDIA } from '../../constants/links';

export default function FooterSection() {
  return (
    <Box
      component="footer"
      sx={{
        pt: { xs: 5, md: 6 },
        pb: { xs: 3, md: 4 },
        borderTop: (t) => `1px solid ${t.palette.divider}`,
        background: (t) => alpha(t.palette.background.paper, 0.5),
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={4}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box
                component="img"
                src={MEDIA.MAKEX_LOGO}
                alt="MakeX"
                sx={{ width: 28, height: 28 }}
              />
              <Typography variant="h6">MakeX</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              A suite of no-code Web3 apps for Make.com that connects 2,500+
              apps to the MultiversX blockchain.
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1.5 }}
            >
              MakeX is a product of HODL Token Club.
            </Typography>
          </Grid>

          <Grid item xs={6} sm={4}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Community
            </Typography>
            <Stack spacing={0.8}>
              <Link
                href={COMMUNITY.DISCORD}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                color="text.secondary"
                underline="hover"
              >
                Discord
              </Link>
              <Link
                href={COMMUNITY.X}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                color="text.secondary"
                underline="hover"
              >
                X (Twitter)
              </Link>
              <Link
                href={COMMUNITY.LINKEDIN}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                color="text.secondary"
                underline="hover"
              >
                LinkedIn
              </Link>
              <Link
                href={COMMUNITY.FACEBOOK}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                color="text.secondary"
                underline="hover"
              >
                Facebook
              </Link>
            </Stack>
          </Grid>

          <Grid item xs={6} sm={4}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Resources
            </Typography>
            <Stack spacing={0.8}>
              <Link
                href={DOCS.LITEPAPER}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                color="text.secondary"
                underline="hover"
              >
                Litepaper
              </Link>
              <Link
                href={DOCS.MVX_WEBSITE}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                color="text.secondary"
                underline="hover"
              >
                MultiversX
              </Link>
              <Link
                href={DOCS.MAKEX_DOCS}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                color="text.secondary"
                underline="hover"
              >
                MultiversX Docs
              </Link>
              <Link
                href={DOCS.MAKE_AI_AGENTS}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                color="text.secondary"
                underline="hover"
              >
                Make AI Agents
              </Link>
            </Stack>
          </Grid>
        </Grid>

        <Divider sx={{ mb: 2 }} />

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ textAlign: 'center', display: 'block' }}
        >
          {'\u00A9'} {new Date().getFullYear()} MakeX by HODL Token Club. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
}
