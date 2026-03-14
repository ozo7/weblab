Webviewer VPS Deployment (Safe Flow)

0) Build the live distribution files:
/scripts/deploy-build.sh

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
- docker compose up -d --build


Notes:
- Do NOT extract the full tarball before running deploy-on-vps.sh.
- deploy-on-vps.sh creates a full backup of /srv/docker/webviewer first.
- deploy-on-vps.sh preserves server-side docker files:
  - /srv/docker/webviewer/docker-compose.yml
  - /srv/docker/webviewer/Dockerfile

