#!/bin/sh
# Puts this checkout's Ore Cloud on the server and restarts it (#550): deploy.sh root@<host>
# The host needs Docker, and /etc/ore-cloud.env holding ORE_DOMAIN and ORE_SESSION_SECRET.
# Only what the image is built from is sent. The accounts and the certificate live in Docker volumes and stay.
set -eu
host=${1:?usage: deploy.sh root@<host>}
cd "$(git rev-parse --show-toplevel)"
git archive HEAD package.json bun.lock packages/core packages/cloud packages/cli/package.json apps/desktop/package.json .dockerignore |
  ssh "$host" 'rm -rf /opt/ore.new && mkdir -p /opt/ore.new && tar -x -C /opt/ore.new && rm -rf /opt/ore && mv /opt/ore.new /opt/ore'
ssh "$host" '
  set -eu
  cd /opt/ore/packages/cloud/deploy
  docker compose --env-file /etc/ore-cloud.env up -d --build --wait
  sh firewall.sh
  cp ore-egress.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable -q ore-egress.service
  . /etc/ore-cloud.env
  for i in 1 2 3 4 5 6; do
    curl -fsS "https://$ORE_DOMAIN/health" && echo " Ore Cloud is up at https://$ORE_DOMAIN" && exit 0
    sleep 10
  done
  echo "The server started but https://$ORE_DOMAIN/health does not answer. Check the domain points at this host: docker compose logs caddy" >&2
  exit 1
'
