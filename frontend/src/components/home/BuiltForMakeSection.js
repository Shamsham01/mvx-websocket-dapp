import React from 'react';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { MEDIA, DOCS } from '../../constants/links';

export default function BuiltForMakeSection() {
  return (
    <Box
      sx={{
        py: { xs: 4, md: 5 },
        borderTop: (t) => `1px solid ${t.palette.divider}`,
        borderBottom: (t) => `1px solid ${t.palette.divider}`,
        background: (t) => alpha(t.palette.background.paper, 0.4),
      }}
    >
      <Container maxWidth="md">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={3}
          alignItems="center"
          justifyContent="center"
        >
          <Box
            component="img"
            src={MEDIA.MAKE_LOGO}
            alt="Make.com"
            sx={{
              height: { xs: 36, md: 44 },
              objectFit: 'contain',
              filter: 'brightness(0) invert(1)',
              opacity: 0.85,
            }}
          />
          <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
            <Typography variant="h5" sx={{ mb: 0.5 }}>
              Built for Make.com
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Connect 2,500+ apps to MultiversX.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            endIcon={<OpenInNewRoundedIcon />}
            href={DOCS.MAKE_AI_AGENTS}
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn More
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
