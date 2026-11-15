FROM node:22-bookworm-slim

WORKDIR /app

# Use npm 11, then install the locked dependencies only once.
RUN npm install -g npm@11 && chown node:node /app

COPY --chown=node:node package.json package-lock.json ./
USER node
RUN npm ci --registry=https://registry.npmjs.org

COPY --chown=node:node . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["npm", "start"]
