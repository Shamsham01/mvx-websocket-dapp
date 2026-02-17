import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';

// Components
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import CreateSubscriptionPage from './pages/CreateSubscriptionPage';
import { AuthProvider } from './context/AuthContext';

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
      <AuthProvider>
        <Router>
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Box component="main" sx={{ flex: 1 }}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route
                  path="/dashboard"
                  element={
                    <Container sx={{ py: 4 }}>
                      <DashboardPage />
                    </Container>
                  }
                />
                <Route
                  path="/subscriptions"
                  element={
                    <Container sx={{ py: 4 }}>
                      <SubscriptionsPage />
                    </Container>
                  }
                />
                <Route
                  path="/subscriptions/new"
                  element={
                    <Container sx={{ py: 4 }}>
                      <CreateSubscriptionPage />
                    </Container>
                  }
                />
                <Route
                  path="/subscriptions/:id"
                  element={
                    <Container sx={{ py: 4 }}>
                      <CreateSubscriptionPage />
                    </Container>
                  }
                />
              </Routes>
            </Box>
            <Box component="footer" sx={{ py: 3, px: 2, mt: 'auto', backgroundColor: 'background.paper' }}>
              <Container maxWidth="lg">
                <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                  <p>MakeX • MultiversX WebSocket Subscription DApp</p>
                  <p>Connect with the MultiversX blockchain in real-time</p>
                </Box>
              </Container>
            </Box>
          </Box>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;