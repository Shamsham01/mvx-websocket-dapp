import React, { useRef, useState } from 'react';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
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
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const handlePlay = () => {
    videoRef.current?.play();
  };

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

      <Container maxWidth="lg">
        <Box
          sx={{
            position: 'relative',
            borderRadius: 3,
            overflow: 'hidden',
            border: (t) => `1px solid ${t.palette.divider}`,
            background: (t) => alpha(t.palette.background.paper, 0.6),
            mx: 'auto',
            maxWidth: 900,
            '& video::-webkit-media-controls-timeline': { display: 'none' },
            '& video::-webkit-media-controls-current-time-display': { display: 'none' },
            '& video::-webkit-media-controls-time-remaining-display': { display: 'none' },
          }}
        >
          <video
            ref={videoRef}
            src={MEDIA.HERO_VIDEO}
            controls={playing}
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            playsInline
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            style={{
              width: '100%',
              display: 'block',
              aspectRatio: '16/9',
              objectFit: 'cover',
              backgroundColor: '#070b14',
            }}
          />
          {!playing && (
            <Box
              onClick={handlePlay}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handlePlay()}
              aria-label="Play presentation video"
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: 'rgba(7, 11, 20, 0.45)',
                transition: 'background 200ms ease',
                '&:hover': { background: 'rgba(7, 11, 20, 0.3)' },
                '&:hover .play-icon': { transform: 'scale(1.08)' },
              }}
            >
              <Box
                className="play-icon"
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: (t) => alpha(t.palette.primary.main, 0.9),
                  boxShadow: '0 8px 32px rgba(70, 217, 255, 0.3)',
                  transition: 'transform 200ms ease',
                }}
              >
                <PlayArrowRoundedIcon sx={{ fontSize: 40, color: '#05111d' }} />
              </Box>
            </Box>
          )}
        </Box>

        <Stack
          direction="row"
          spacing={0.8}
          justifyContent="center"
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 3 }}
        >
          <Typography variant="caption" color="text.secondary">
            Wallet login:
          </Typography>
          {['xPortal', 'Ledger', 'Web Wallet'].map((w, i) => (
            <React.Fragment key={w}>
              {i > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {'\u2022'}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {w}
              </Typography>
            </React.Fragment>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}
