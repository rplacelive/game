#!/bin/bash
# This script sets up a systemd unit for the rplace server to run in the background and start on boot (Linux only).

if [ -z "$1" ]
then
	echo -e "\x1b[31mPlease input the absolute path to the rplace server directory as an argument, e.g. /home/pi/rslashplace2.github.io"
	exit 1
fi

if [ ! -d "$1" ]; then
	echo -e "\x1b[31mProvided path is not a valid directory."
	exit 1
fi

bun_dir=$(which bun)

if [ -z "$bun_dir" ]; then
	echo -e "\x1b[31mBun is not installed or not in PATH."
	exit 1
fi

echo -e "
[Unit]
Description=rplace.live canvas server
After=network.target

[Service]
Type=simple
WorkingDirectory=$1
ExecStart=
ExecStart=$bun_dir run server.ts
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
" | sudo tee /etc/systemd/system/place.service > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable place.service
sudo systemctl start place.service

echo "Task completed. You can check the service with: sudo systemctl status place.service"
