import React, { useState, useCallback } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Popper,
  TextField,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { wordlists } from 'bip39';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import { generatePemContent } from '../utils/pemGenerator';
import { useNotify } from '../context/NotificationContext';

const BIP39_WORDS = wordlists.english;
const WORD_COUNT = 24;

function filterWords(input, options) {
  if (!input || input.length < 2) return [];
  const lower = input.toLowerCase().trim();
  return options.filter((w) => w.toLowerCase().startsWith(lower)).slice(0, 8);
}

export default function PemGeneratorPage() {
  const notify = useNotify();
  const [words, setWords] = useState(() => Array(WORD_COUNT).fill(''));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleWordChange = useCallback((index, value) => {
    const str = typeof value === 'string' ? value : value?.label ?? '';
    setWords((prev) => {
      const next = [...prev];
      next[index] = str;
      return next;
    });
    setError('');
  }, []);

  const handlePaste = useCallback((e) => {
    const pasted = e.clipboardData?.getData?.('text')?.trim();
    if (!pasted || !pasted.includes(' ')) return;
    const tokens = pasted.split(/\s+/).filter(Boolean);
    if (tokens.length !== WORD_COUNT) return;
    e.preventDefault();
    setWords([...tokens]);
    setError('');
  }, []);

  const getSeedPhrase = useCallback(() => {
    return words.filter(Boolean).join(' ').trim();
  }, [words]);

  const handleGenerate = useCallback(async () => {
    const seed = getSeedPhrase();
    if (!seed) {
      setError('Enter your seed phrase');
      return;
    }

    const wordList = seed.split(/\s+/);
    if (wordList.length !== WORD_COUNT) {
      setError(`MultiversX seed phrase must have exactly ${WORD_COUNT} words`);
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const pemContent = generatePemContent(seed);

      const blob = new Blob([pemContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wallet.pem';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notify('PEM file downloaded. Seed phrase cleared from memory.', 'success');

      setWords(Array(WORD_COUNT).fill(''));
    } catch (err) {
      setError(err?.message || 'Failed to generate PEM');
      notify(err?.message || 'Failed to generate PEM', 'error');
    } finally {
      setGenerating(false);
    }
  }, [getSeedPhrase, notify]);

  return (
    <Box>
      <PageHeader
        title="PEM Generator"
        description="Generate a PEM file from your seed phrase for Make.com authentication with MakeX apps. All processing happens locally—nothing is stored or sent."
      />

      <SectionCard
        title="Seed phrase"
        description="Enter your 24-word MultiversX recovery phrase. Words are suggested as you type."
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
            gap: 1.5,
          }}
        >
          {words.map((w, i) => (
            <Autocomplete
              key={i}
              freeSolo
              options={filterWords(w, BIP39_WORDS)}
              value={w}
              onInputChange={(_, v) => handleWordChange(i, v)}
              onChange={(_, v) => handleWordChange(i, v)}
              inputValue={w}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={`Word ${i + 1}`}
                  size="small"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  onPaste={i === 0 ? handlePaste : undefined}
                  inputProps={{
                    ...params.inputProps,
                    autoComplete: 'off',
                  }}
                />
              )}
              PopperComponent={(props) => (
                <Popper {...props} placement="bottom-start" modifiers={[{ name: 'offset', options: { offset: [0, 4] } }]} />
              )}
              ListboxProps={{ sx: { maxHeight: 200 } }}
            />
          ))}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 3 }}>
          <Button
            variant="contained"
            startIcon={generating ? <CircularProgress color="inherit" size={18} /> : <DownloadRoundedIcon />}
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate & Download PEM'}
          </Button>
        </Box>
      </SectionCard>

      <SectionCard
        title="Security"
        description="How we protect your seed phrase and PEM."
        sx={{ mt: 2 }}
      >
        <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.75 } }}>
          <li>
            <strong>Local only:</strong> Seed phrase and PEM are never sent to any server.
          </li>
          <li>
            <strong>No storage:</strong> Nothing is saved to localStorage, sessionStorage, or cookies.
          </li>
          <li>
            <strong>Memory wipe:</strong> Seed phrase is cleared from React state immediately after the PEM file is downloaded.
          </li>
          <li>
            <strong>Browser autocomplete off:</strong> Inputs disable browser autocomplete to reduce exposure.
          </li>
        </Box>
      </SectionCard>
    </Box>
  );
}
