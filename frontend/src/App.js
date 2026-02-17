import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { DappProvider } from '@multiversx/sdk-dapp/wrappers';

// Components
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import CreateSubscriptionPage from './pages/CreateSubscriptionPage';
import { AuthProvider } from './context/AuthContext';

// MultiversX network: mainnet | testnet | devnet
const MVX_ENV = process.env.REACT_APP_MVX_ENV || 'mainnet';

// Create theme
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#23f7dd',
    },
    secondary: {
      main: '#ff6b6b',
    },
    background: {
      default: '#0a0a0a',
      paper: '#1a1a1a',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <DappProvider
        environment={MVX_ENV}
        dappConfig={{
          shouldUseWebViewProvider: true,
        }}
      >
        <AuthProvider>
          <Router>
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Container component="main" sx={{ flex: 1, py: 4 }}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/subscriptions" element={<SubscriptionsPage />} />
                <Route path="/subscriptions/new" element={<CreateSubscriptionPage />} />
                <Route path="/subscriptions/:id" element={<CreateSubscriptionPage />} />
              </Routes>
            </Container>
            <Box component="footer" sx={{ py: 3, px: 2, mt: 'auto', backgroundColor: 'background.paper' }}>
              <Container maxWidth="lg">
                <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                  <p>MultiversX WebSocket Subscription DApp • Built with ❤️ by ClawB</p>
                  <p>Connect with the MultiversX blockchain in real-time</p>
                </Box>
              </Container>
            </Box>
          </Box>
        </Router>
      </AuthProvider>
      </DappProvider>
    </ThemeProvider>
  );
}

export default App;