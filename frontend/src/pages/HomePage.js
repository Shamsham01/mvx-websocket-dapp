import React from 'react';
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

export default function HomePage() {
  return (
    <Box>
      <HeroSection />
      <BuiltForMakeSection />
      <UseCasesSection />
      <AppsToolkitSection />
      <WebSocketPreviewSection />
      <AiAgentsSection />
      <FreeTrialSection />
      <InstallAppsSection />
      <FooterSection />
    </Box>
  );
}
