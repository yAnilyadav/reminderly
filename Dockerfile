FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
# This runs migrations THEN starts the app - works for ALL environments
CMD ["npm", "run", "start:with-migrations"]