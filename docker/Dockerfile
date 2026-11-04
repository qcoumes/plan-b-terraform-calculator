# Dev image. The code is mounted and node_modules is a volume (docker-compose.yml),
# so this rarely needs rebuilding.
FROM node:24.22.2-bookworm-slim

# New volumes on these paths start with this ownership.
RUN mkdir -p /app/node_modules /home/node/.cache/yarn \
 && chown -R node:node /app /home/node

# Not COPY --chmod: that needs BuildKit, and not every docker-compose uses it.
COPY entrypoint.sh /usr/local/bin/dev-entrypoint
RUN chmod 755 /usr/local/bin/dev-entrypoint

WORKDIR /app
EXPOSE 8765

ENTRYPOINT ["dev-entrypoint"]
# docker-compose.yml only publishes the port on the host's 127.0.0.1.
CMD ["yarn", "dev", "--host", "0.0.0.0"]
