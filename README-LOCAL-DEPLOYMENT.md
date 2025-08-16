# Local Secure Deployment Guide

This application has been restructured to run sensitive data processing functions locally while maintaining cloud-based authentication through Supabase.

## Architecture Overview

### Cloud Components (Supabase)
- **Authentication**: User authentication and session management
- **Database**: User profiles, firm data, and metadata (non-sensitive)
- **Storage**: File storage with RLS policies

### Local Components
- **Document Processing**: All sensitive legal document processing
- **AI Analysis**: OpenAI API calls for document analysis and generation
- **External API Integration**: NetDocs and other legal database connections

## Local API Routes

The following sensitive functions have been moved to local Next.js API routes in `/public/api/`:

### Core Functions
- `POST /api/rag-generate` - Legal document generation with AI
- `POST /api/intelligent-document-discovery` - AI-powered document discovery
- `POST /api/process-docx` - DOCX document processing and text extraction

### External Integrations
- `POST /api/netdocs-oauth` - NetDocs OAuth authentication
- `POST /api/netdocs-sync` - NetDocs document synchronization
- `POST /api/db-upload-relay` - Secure file upload relay

## Environment Variables

### Required for Local Deployment
```env
# Supabase (for authentication only)
NEXT_PUBLIC_SUPABASE_URL=https://vrxzwhbbblkqraimfclt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI API (for local processing)
OPENAI_API_KEY=your_openai_api_key

# NetDocs Integration (if using)
NETDOCS_CLIENT_ID=your_netdocs_client_id
NETDOCS_CLIENT_SECRET=your_netdocs_client_secret

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Security Benefits

### Data Protection
- **Personal Legal Information (PLI)** never leaves your local server
- Document content is processed locally, not sent to cloud functions
- AI processing happens on your infrastructure with your API keys

### Authentication Security
- Supabase handles secure authentication and session management
- Local routes validate Supabase JWT tokens for authorization
- RLS policies still protect metadata in the cloud database

### Compliance
- Meets requirements for legal firms handling sensitive client data
- Allows compliance with attorney-client privilege requirements
- Provides audit trail for document access and processing

## Deployment Steps

### 1. Server Setup
```bash
# Clone and install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration
```

### 2. Database Configuration
```bash
# Supabase database remains in cloud for authentication
# No migration needed - existing schema is compatible
```

### 3. Start Local Server
```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

### 4. SSL/TLS Configuration (Production)
- Configure reverse proxy (nginx/Apache) with SSL certificates
- Use Let's Encrypt or corporate SSL certificates
- Ensure HTTPS for all client communications

## Network Security

### Recommended Setup
- **Internal Network**: Deploy on internal corporate network
- **VPN Access**: Require VPN for external access
- **Firewall Rules**: Restrict access to necessary ports only
- **Load Balancer**: Use SSL termination at load balancer

### API Security
- All routes require valid Supabase JWT token
- CORS configured for your domain only
- Rate limiting recommended for production

## Monitoring and Logging

### Health Checks
- Monitor API route response times
- Track OpenAI API usage and costs
- Monitor document processing success rates

### Audit Logging
- All document access logged locally
- User authentication events via Supabase
- File upload and processing audit trail

## Backup and Recovery

### Local Data
- Regular backups of processed documents
- Database backups of local processing logs
- Configuration backups

### Cloud Data
- Supabase handles authentication data backups
- Metadata and user profiles backed up by Supabase

## Troubleshooting

### Common Issues
1. **Authentication Failures**: Check Supabase token validation
2. **OpenAI API Errors**: Verify API key and rate limits
3. **File Processing Errors**: Check file permissions and storage
4. **NetDocs Integration**: Verify OAuth credentials and tokens

### Debugging
- Check browser network tab for API call failures
- Review server logs for detailed error messages
- Use Supabase dashboard for authentication issues

## Migration from Cloud Functions

The frontend has been updated to call local API routes instead of Supabase Edge Functions. No database schema changes were required. All existing data remains compatible.

### Changed Components
- `DatabaseSettings.tsx` - Now calls local NetDocs integration routes  
- `DocumentGenerator.tsx` - Now calls local RAG generation route
- `IntelligentCaseAnalysis.tsx` - Now calls local document discovery route

## Future Enhancements

### Planned Features
- Document encryption at rest
- Advanced audit logging
- Multi-tenant isolation
- Disaster recovery automation

### Scalability
- Horizontal scaling with load balancers
- Database clustering for high availability
- CDN for static assets
- Container deployment with Docker/Kubernetes