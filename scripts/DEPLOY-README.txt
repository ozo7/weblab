Webviewer VPS Deployment (Safe Flow)

1) Upload artifact to VPS (/tmp):
scp /home/ozo/ais/weblab/dist.tar.gz admin@isonthenet.de:/tmp/dist.tar.gz

2) Extract only deploy script to /tmp:
cd /tmp
tar -xzf /tmp/dist.tar.gz ./scripts/deploy-on-vps.sh

3) Make script executable:
chmod +x /tmp/scripts/deploy-on-vps.sh

4) Run deployment script from /tmp:
sudo bash /tmp/scripts/deploy-on-vps.sh /tmp/dist.tar.gz

5) Run printed commands manually (it now includes):
- docker compose config
- docker compose up -d --build
- status + curl checks

Notes:
- Do NOT extract the full tarball before running deploy-on-vps.sh.
- deploy-on-vps.sh creates a full backup of /srv/docker/webviewer first.
- deploy-on-vps.sh preserves server-side docker files:
  - /srv/docker/webviewer/docker-compose.yml
  - /srv/docker/webviewer/Dockerfile

Post-deploy mediaAlias check:
1) cat /srv/docker/webviewer/config/manual-settings.json
2) docker inspect webviewer --format '{{json .Mounts}}' | sed 's/},{/},\n{/g'
3) docker exec webviewer sh -lc 'ls -ld /data/zz-media-files /srv/docker/richardwili/html/files 2>/dev/null || true'

If only /data/zz-media-files exists inside container, set:
"mediaAlias": "/data/zz-media-files"
in /srv/docker/webviewer/config/manual-settings.json, then:
cd /srv/docker/webviewer
docker compose up -d --build
