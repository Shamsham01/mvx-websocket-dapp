import React from 'react';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import GetAppRoundedIcon from '@mui/icons-material/GetAppRounded';
import CellTowerRoundedIcon from '@mui/icons-material/CellTowerRounded';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { openWalletConnect } from '../../utils/walletConnect';
import { MEDIA } from '../../constants/links';

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

export default function HeroSection({ onOpenTrial }) {
  const { user } = useAuth();

  const handleTrialClick = () => {
    if (!user) {
      openWalletConnect();
      return;
    }
    onOpenTrial?.();
  };

  return (
    <Box sx={{ pt: { xs: 8, md: 12 }, pb: { xs: 6, md: 10 }, textAlign: 'center' }}>
      <Container maxWidth="md">
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: '2rem', sm: '2.5rem', md: '3.25rem' },
            mb: 2,
            background: 'linear-gradient(135deg, #ecf2ff 0%, #46d9ff 50%, #8a7cff 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {`MakeX: The \u201CZapier\u201D of MultiversX`}
        </Typography>

        <Typography
          variant="h5"
          color="text.secondary"
          sx={{
            fontWeight: 400,
            mb: 4,
            maxWidth: 560,
            mx: 'auto',
            fontSize: { xs: '1rem', md: '1.125rem' },
          }}
        >
          Your Gateway to AI, Automation, and Blockchain Innovation.
        </Typography>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          justifyContent="center"
          sx={{ mb: 5 }}
        >
          <Button variant="contained" size="large" onClick={handleTrialClick}>
            Try Free for 30 Days
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<GetAppRoundedIcon />}
            onClick={() => scrollTo('install')}
          >
            Install Apps
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<CellTowerRoundedIcon />}
            component={RouterLink}
            to="/subscriptions"
          >
            WebSocket Subscriptions
          </Button>
        </Stack>
      </Container>

      <Box
        sx={{
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          mt: { xs: 1, md: 2 },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            border: (t) => `1px solid ${t.palette.divider}`,
            background: (t) => alpha(t.palette.background.paper, 0.6),
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
            preload="auto"
            style={{
              width: '100%',
              display: 'block',
              aspectRatio: '16/9',
              objectFit: 'cover',
              backgroundColor: '#070b14',
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
