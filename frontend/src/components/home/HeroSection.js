import React from 'react';
import { Box, Button, Container, Grid, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { motion, useReducedMotion } from 'framer-motion';
import GetAppRoundedIcon from '@mui/icons-material/GetAppRounded';
import CellTowerRoundedIcon from '@mui/icons-material/CellTowerRounded';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { openWalletConnect } from '../../utils/walletConnect';
import { MEDIA } from '../../constants/links';
import { MAKEX_FREE_TRIAL_DAYS } from '../../constants/mvx';

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

const easePremium = [0.16, 1, 0.3, 1];

export default function HeroSection({ onOpenTrial }) {
  const { user } = useAuth();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  const handleTrialClick = () => {
    if (!user) {
      openWalletConnect();
      return;
    }
    onOpenTrial?.();
  };

  const fadeUpProps = reduceMotion
    ? {}
    : {
        component: motion.div,
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.42, ease: easePremium },
      };

  const mediaProps = reduceMotion
    ? {}
    : {
        component: motion.div,
        initial: { opacity: 0, scale: 0.985 },
        animate: { opacity: 1, scale: 1 },
        transition: { duration: 0.52, ease: easePremium, delay: 0.08 },
      };

  const surface = alpha(theme.palette.background.paper, 0.92);

  return (
    <Box
      sx={{
        pt: { xs: 5, md: 7 },
        pb: { xs: 7, md: 11 },
        minHeight: { md: 'calc(100dvh - 68px)', xs: 'auto' },
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
          <Grid item xs={12} md={6}>
            <Box {...fadeUpProps}>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mb: 1,
                  color: 'primary.main',
                  letterSpacing: '0.04em',
                  fontWeight: 600,
                  textAlign: { xs: 'center', md: 'left' },
                }}
              >
                MakeX platform
              </Typography>
              <Typography
                variant="h1"
                component="h1"
                sx={{
                  textAlign: { xs: 'center', md: 'left' },
                  fontSize: { xs: '2rem', sm: '2.5rem', md: 'clamp(2.5rem, 3.6vw, 3.35rem)' },
                  mb: 1.75,
                  color: 'text.primary',
                  textWrap: 'balance',
                  fontWeight: 700,
                  lineHeight: 1.06,
                  letterSpacing: '-0.03em',
                  '& .accent': {
                    color: 'primary.light',
                    fontWeight: 700,
                  },
                }}
              >
                Your Gateway to AI, Automation, and{' '}
                <Box component="span" className="accent">
                  Blockchain Innovation
                </Box>
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{
                  maxWidth: '46ch',
                  mx: { xs: 'auto', md: 0 },
                  mb: { xs: 3, md: 3.25 },
                  fontSize: { xs: '0.98rem', sm: '1.06rem' },
                  lineHeight: 1.7,
                  textAlign: { xs: 'center', md: 'left' },
                }}
              >
                Simplifying Web3 workflows with no-code tools on MultiversX
              </Typography>

              {/* Row 1: primary full width sm–md so row 2 stays two aligned outlines */}
              <Box
                sx={{
                  display: 'grid',
                  gap: { xs: 1.25, md: 1.5 },
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    md: 'repeat(3, minmax(0, 1fr))',
                  },
                  width: '100%',
                  maxWidth: { md: 'none', sm: '100%' },
                  gridAutoFlow: 'row',
                }}
              >
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleTrialClick}
                  sx={{
                    gridColumn: { xs: '1', sm: '1 / -1', md: 'auto' },
                    py: { xs: 1.35, md: 1.2 },
                  }}
                >
                  Try free for {MAKEX_FREE_TRIAL_DAYS} days
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<GetAppRoundedIcon />}
                  onClick={() => scrollTo('install')}
                  sx={{ py: { xs: 1.25, md: 1.1 } }}
                >
                  Install apps
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<CellTowerRoundedIcon />}
                  component={RouterLink}
                  to="/subscriptions"
                  sx={{ py: { xs: 1.25, md: 1.1 } }}
                >
                  WebSocket subscriptions
                </Button>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box
              sx={{
                position: 'relative',
                mx: 'auto',
                maxWidth: 720,
              }}
              {...mediaProps}
            >
              <Box
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  overflow: 'hidden',
                  borderRadius: { xs: '16px', md: '22px 20px 22px 20px' },
                  border: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
                  backgroundColor: surface,
                  backgroundImage:
                    'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 42%)',
                  boxShadow: `
                    inset 0 1px 0 rgba(255,255,255,0.065),
                    0 2px 4px rgba(6,12,18,0.2),
                    0 28px 56px -16px rgba(6,14,22,0.55)
                  `,
                }}
              >
                <video
                  src={MEDIA.HERO_VIDEO}
                  autoPlay
                  muted
                  loop
                  controls={false}
                  disablePictureInPicture
                  playsInline
                  preload="metadata"
                  style={{
                    width: '100%',
                    display: 'block',
                    aspectRatio: '16/9',
                    objectFit: 'cover',
                    backgroundColor: theme.palette.background.default,
                  }}
                />
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
