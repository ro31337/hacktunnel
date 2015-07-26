# HackTunnel

HackTunnel is web-based peer-to-peer chat software for anonymous and encrypted communication. Chat messages are encrypted
twice: with TLS and OTR.

With HackTunnel you won't need any IM applications, just a browser:

1. Navigate to https://hacktunnel.com or https://hacktunnel.com/your_unique_tunnel_name.
2. Enter pre-shared passphrase (highly recommended) and click "Start".
3. Share your browser's url address with your friend.

And here you go, chat room is created and ready to use.

HackTunnel is fully open sourced and licensed under AGPL. You can easily set up your own instance of HackTunnel and communicate with your friends securely!

## How to setup your own server

Required OS: Linux or FreeBSD with Redis, NodeJS and Go language installed.


```bash
go get github.com/nats-io/gnatsd
cp nats-server.conf.sample nats-server.conf
gnatsd -c nats-server.conf &
redis-server &
make get-deps
make
cp hacktunnel.conf.sample hacktunnel.conf
make run
```

Navigate to http://localhost:2000

See comments in the sample hacktunnel.conf.sample for setting up server parameters.

## Plans

* Add WebRTC support for video/voice conferencing
* Support chat rooms for more than 2 peers
* Support for majority of browsers (including browsers for mobile devices)

## License

AGPL 3
