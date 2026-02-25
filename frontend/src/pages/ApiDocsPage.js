import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { alpha } from '@mui/material/styles';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import swaggerSpec from '../constants/swaggerSpec';

const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function ApiDocsPage() {
  return (
    <Box>
      <PageHeader
        title="API Swagger Docs"
        description="Modern interactive documentation for MakeX backend endpoints."
        actions={
          <Button
            variant="outlined"
            href={apiBaseUrl}
            target="_blank"
            rel="noreferrer"
            startIcon={<OpenInNewRoundedIcon />}
          >
            Open Raw API Index
          </Button>
        }
      />

      <SectionCard
        title="MakeX API Explorer"
        description={`Server: ${apiBaseUrl}`}
        sx={{
          '& .swagger-ui': {
            '--swagger-ui-font-family': '"Inter", "Roboto", "Segoe UI", sans-serif',
            background: 'transparent',
            color: '#ecf2ff'
          },
          '& .swagger-ui .topbar': {
            display: 'none'
          },
          '& .swagger-ui .scheme-container': {
            borderRadius: 12,
            background: alpha('#0f1628', 0.65),
            boxShadow: 'none',
            border: `1px solid ${alpha('#94a3b8', 0.2)}`
          },
          '& .swagger-ui .opblock': {
            borderRadius: 12,
            border: `1px solid ${alpha('#94a3b8', 0.2)}`,
            overflow: 'hidden'
          },
          '& .swagger-ui .opblock .opblock-section-header': {
            background: alpha('#0f172a', 0.66),
            borderBottomColor: alpha('#94a3b8', 0.2)
          },
          '& .swagger-ui .opblock .opblock-body, & .swagger-ui .responses-wrapper, & .swagger-ui .parameters-container': {
            background: alpha('#0b1324', 0.64),
            borderRadius: 10
          },
          '& .swagger-ui .response-control-media-type__accept-message, & .swagger-ui .responses-table .response': {
            color: '#e2e8f0'
          },
          '& .swagger-ui .opblock-tag': {
            borderBottomColor: alpha('#94a3b8', 0.24),
            color: '#ecf2ff'
          },
          '& .swagger-ui .btn.authorize': {
            borderColor: alpha('#46d9ff', 0.55),
            color: '#46d9ff'
          },
          '& .swagger-ui .info .title, & .swagger-ui .info p, & .swagger-ui .opblock-summary-path, & .swagger-ui .opblock-summary-description, & .swagger-ui .parameter__name, & .swagger-ui .parameter__type, & .swagger-ui .response-col_status, & .swagger-ui .response-col_description, & .swagger-ui table thead tr td, & .swagger-ui table thead tr th': {
            color: '#ecf2ff'
          },
          '& .swagger-ui .model, & .swagger-ui .model-title, & .swagger-ui .tab li, & .swagger-ui label, & .swagger-ui section.models h4, & .swagger-ui section.models h5': {
            color: '#cbd5e1'
          },
          '& .swagger-ui .responses-inner h4, & .swagger-ui h2, & .swagger-ui h3': {
            color: '#ecf2ff'
          },
          '& .swagger-ui .markdown p, & .swagger-ui .renderedMarkdown p': {
            color: '#cbd5e1'
          },
          '& .swagger-ui input[type=text], & .swagger-ui textarea, & .swagger-ui select': {
            background: alpha('#0b1324', 0.85),
            color: '#e2e8f0',
            border: `1px solid ${alpha('#94a3b8', 0.35)}`,
            borderRadius: 10
          },
          '& .swagger-ui .dialog-ux .backdrop-ux': {
            background: alpha('#020617', 0.72)
          },
          '& .swagger-ui .dialog-ux .modal-ux': {
            borderRadius: 14,
            border: `1px solid ${alpha('#94a3b8', 0.3)}`,
            background: alpha('#0b1324', 0.96),
            boxShadow: '0 20px 50px rgba(2, 8, 20, 0.6)'
          },
          '& .swagger-ui .dialog-ux .modal-ux-header': {
            background: alpha('#111c34', 0.92),
            borderBottomColor: alpha('#94a3b8', 0.24)
          },
          '& .swagger-ui .dialog-ux .modal-ux-content, & .swagger-ui .dialog-ux .modal-ux-header h3, & .swagger-ui .dialog-ux .auth-container h4, & .swagger-ui .dialog-ux .auth-container p, & .swagger-ui .dialog-ux label, & .swagger-ui .dialog-ux svg': {
            color: '#e2e8f0'
          },
          '& .swagger-ui .dialog-ux .auth-btn-wrapper .btn-done': {
            background: 'linear-gradient(90deg, #46d9ff 0%, #8a7cff 100%)',
            borderColor: 'transparent',
            color: '#05111d',
            fontWeight: 700
          },
          '& .swagger-ui .btn.execute': {
            background: 'linear-gradient(90deg, #46d9ff 0%, #8a7cff 100%)',
            borderColor: 'transparent',
            color: '#05111d',
            fontWeight: 700
          }
        }}
      >
        <Stack direction="row" spacing={1.4} alignItems="center" sx={{ mb: 2 }}>
          <Box
            component="img"
            src="https://i.ibb.co/rsPX3fy/Make-X-Logo-Trnasparent-BG.png"
            alt="MakeX logo"
            sx={{ width: 42, height: 42, objectFit: 'contain' }}
          />
          <Typography variant="body2" color="text.secondary">
            Authorize with your JWT token to test protected endpoints directly from this page.
          </Typography>
        </Stack>
        <SwaggerUI spec={swaggerSpec} docExpansion="list" defaultModelsExpandDepth={1} />
      </SectionCard>
    </Box>
  );
}
