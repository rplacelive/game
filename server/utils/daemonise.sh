#!/bin/bash
# This script will alow the server software to always run in the background, and auto load on reboot using a systemd unit (only works on linux)
if [ -z "$1" ]
then
    echo -e "\x1b[31mPlease input the path to the rplace server directory as an argument e.g home/pi/rslashplace2.github.io"
    exit 0
fi

bun_dir=$(which bun)
dotnet_dir=$(which dotnet)

echo -e "
[Unit]
Description=main place websocket server, see http-place for the static http server.
After=network.target

[Service]
Type=simple
StandardInput=tty-force
TTYVHangup=yes
TTYPath=/dev/tty20
TTYReset=yes
WorkingDirectory=$1
ExecStart=
ExecStart=$bun_dir server.js
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
" | sudo tee -a /etc/systemd/system/place.service
sudo systemctl daemon-reload

sudo systemctl enable place.service
sudo systemctl start place.service

echo "Task completed."
