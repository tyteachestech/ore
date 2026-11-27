#!/bin/sh
# Closes the server's network to every address that isn't the public web (#550). The server opens the links
# people send it, and guard.ts refuses a private address before each fetch; this is the second lock, for a
# name that answers with a public address when checked and a private one when fetched (DNS rebinding), and
# for the cloud's metadata address. Run as root on the host, before the
# server starts (Docker keeps what it finds in DOCKER-USER); safe to run again.
set -eu
SUBNET=172.30.0.0/24 # compose.yml's `out` network
iptables -N DOCKER-USER 2>/dev/null || true
iptables -N ORE-EGRESS 2>/dev/null || iptables -F ORE-EGRESS
for net in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.168.0.0/16 198.18.0.0/15 224.0.0.0/3; do
  iptables -A ORE-EGRESS -d "$net" -j DROP
done
# Through the host to elsewhere (other containers, the private network, metadata).
iptables -C DOCKER-USER -s "$SUBNET" -m conntrack --ctstate NEW -j ORE-EGRESS 2>/dev/null ||
  iptables -I DOCKER-USER -s "$SUBNET" -m conntrack --ctstate NEW -j ORE-EGRESS
# To the host itself (its SSH, anything else it listens on).
iptables -C INPUT -s "$SUBNET" -m conntrack --ctstate NEW -j DROP 2>/dev/null ||
  iptables -I INPUT -s "$SUBNET" -m conntrack --ctstate NEW -j DROP
