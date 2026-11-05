# Image de dev / outils (Vite, lint, tests, build). Le code est monté, node_modules vit dans un volume nommé.
FROM node:22.14.0-alpine3.21

WORKDIR /app
RUN mkdir -p /app/node_modules && chown -R node:node /app

USER node
EXPOSE 5173
