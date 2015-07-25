// HackTunnel project
// (C) 2015 DevHQ, http://devhq.io
// License: AGPL 3

package mq

import (
	"hacktunnel/config"
	"log"
	"strings"

	"github.com/nats-io/nats"
)

func asyncErrorHandler(c *nats.Conn, sub *nats.Subscription, err error) {
	log.Printf("ERROR LOST MESSAGE err: %+v\n", err)
}

func getNatsOptions(chanLen int) *nats.Options {
	opts := nats.DefaultOptions
	opts.SubChanLen = chanLen
	opts.AsyncErrorCB = asyncErrorHandler
	opts.Servers = config.C().Nats
	for i, s := range opts.Servers {
		opts.Servers[i] = strings.Trim(s, " ")
	}
	opts.Secure = config.C().NatsUseTls
	return &opts
}

type Conn struct {
	nats.EncodedConn
}
type Sub struct {
	nats.Subscription
}

func MakeSub(sub *nats.Subscription) *Sub {
	return &Sub{*sub}
}

func Connect(chanLen int) *Conn {
	natsopts := getNatsOptions(chanLen)
	c, err := natsopts.Connect()
	if err != nil {
		panic(err)
	}
	ec, err := nats.NewEncodedConn(c, "gob")
	return &Conn{*ec}
}
