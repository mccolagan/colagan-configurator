# Tests E2E. La version doit correspondre exactement à @playwright/test dans package.json.
# node_modules dédié (volume séparé) : les binaires natifs (esbuild, rollup) diffèrent entre Alpine et Ubuntu.
FROM mcr.microsoft.com/playwright:v1.49.1-noble

WORKDIR /app
RUN mkdir -p /app/node_modules && chown -R 1000:1000 /app
