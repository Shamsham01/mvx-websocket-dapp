FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src ./src
COPY .env.example ./

# Create necessary directories
RUN mkdir -p data logs

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "src/index.js"]