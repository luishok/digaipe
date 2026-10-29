# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

# One-shot setup container: migrations, database grants, admin user and seed data.
# Keeps the full toolchain (drizzle-kit, tsx) out of the runtime image.
FROM build AS setup
CMD ["sh", "scripts/docker/setup.sh"]

FROM node:24-bookworm-slim AS app
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/build ./build
# The PDF template and crest are read from ./static at runtime.
COPY static ./static
RUN mkdir -p var/uploads && chown -R node:node var
USER node
EXPOSE 3000
CMD ["node", "build"]
