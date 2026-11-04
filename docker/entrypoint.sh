#!/bin/sh
# Gives the `node` user the uid/gid of the mounted checkout, so files created in
# it belong to the developer, then reinstalls dependencies if package.json or
# yarn.lock changed since last time.
set -eu

if [ "$(id -u)" = 0 ]; then
  uid=$(stat -c %u /app)
  gid=$(stat -c %g /app)
  # Some Docker Desktop setups mount the checkout as root: keep uid 1000 then.
  if [ "$uid" != 0 ]; then
    if [ "$gid" != "$(id -g node)" ]; then groupmod --non-unique --gid "$gid" node; fi
    if [ "$uid" != "$(id -u node)" ]; then usermod --non-unique --uid "$uid" --gid "$gid" node; fi
  fi
  for dir in /app/node_modules /home/node/.cache/yarn; do
    if [ "$(stat -c %u:%g "$dir")" != "$(id -u node):$(id -g node)" ]; then
      chown -R node:node "$dir"
    fi
  done
  HOME=/home/node exec setpriv --reuid=node --regid=node --init-groups "$0" "$@"
fi

stamp=node_modules/.install-stamp
checksum=$(cat package.json yarn.lock | sha256sum | cut -d " " -f 1)
if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$checksum" ]; then
  echo "Installing dependencies (package.json or yarn.lock changed)..."
  yarn install --frozen-lockfile --non-interactive
  echo "$checksum" > "$stamp"
fi

exec "$@"
