import React, { useState } from 'react';
import { Box } from '@mui/material';
import HeroSection from '../components/home/HeroSection';
import BuiltForMakeSection from '../components/home/BuiltForMakeSection';
import UseCasesSection from '../components/home/UseCasesSection';
import AppsToolkitSection from '../components/home/AppsToolkitSection';
import WebSocketPreviewSection from '../components/home/WebSocketPreviewSection';
import AiAgentsSection from '../components/home/AiAgentsSection';
import FreeTrialSection from '../components/home/FreeTrialSection';
import InstallAppsSection from '../components/home/InstallAppsSection';
import FooterSection from '../components/home/FooterSection';
import FreeTrialDialog from '../components/home/FreeTrialDialog';

export default function HomePage() {
  const [trialOpen, setTrialOpen] = useState(false);

  return (
    <Box>
      <HeroSection onOpenTrial={() => setTrialOpen(true)} />
      <BuiltForMakeSection />
      <UseCasesSection />
      <AppsToolkitSection />
      <WebSocketPreviewSection />
      <AiAgentsSection />
      <FreeTrialSection onOpenTrial={() => setTrialOpen(true)} />
      <InstallAppsSection />
      <FooterSection />
      <FreeTrialDialog open={trialOpen} onClose={() => setTrialOpen(false)} />
    </Box>
  );
}
