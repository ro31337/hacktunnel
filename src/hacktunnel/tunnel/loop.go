// HackTunnel project
// (C) 2015 DevHQ, http://devhq.io
// License: AGPL 3

package tunnel

import (
	"hacktunnel/mq"
	"hacktunnel/stat"
	"log"
	"sync"
	"time"

	"github.com/dchest/uniuri"
	"github.com/devhq-io/ax"
)

const (
	msgKick             int = iota + 1 // Kick to initiate conversation
	msgSimpleData                      // Raw data from remote side
	msgSimpleDisconnect                // Remote side disconnects
	msgCmdShutdown                     // shutdown tunnel at the backend

	tunnelMqChanLen = 32
)

var (
	wg             sync.WaitGroup
	serverChanName string
	mqc            *mq.Conn
)

type tunnelmsg struct {
	Code int
	Data interface{}
}

func init() {
	// This mq is unique for each server
	serverChanName = "server_chan_" + uniuri.NewLen(20)
}

func Init() {
	mqc = mq.Connect(tunnelMqChanLen)
	if mqc == nil {
		log.Fatalf("tunnel Init error: no mqc\n")
	}
}

func Shutdown() {
	if mqc != nil {
		mqc.Close()
	}
}

func sendSimpleInit(c *ax.Client, tunnelId string, otrInit bool) {
	type simpleInitArgs struct {
		Status  string `json:"status"`
		Id      string `json:"id"`
		OtrInit bool   `json:"otr_init"`
	}
	c.JsonSend("on_simple_init",
		&simpleInitArgs{Status: "ok", Id: tunnelId, OtrInit: otrInit})
}

func sendSimpleData(c *ax.Client, tunnelId string, data string) {
	type simpleRecvArgs struct {
		Id   string `json:"id"`
		Data string `json:"data"`
	}
	c.JsonSend("on_simple_recv",
		&simpleRecvArgs{Id: tunnelId, Data: data})
}

func sendSimpleDisconnect(c *ax.Client, tunnelId string) {
	c.JsonSend("on_simple_disconnect",
		&struct {
			Id string `json:"id"`
		}{Id: tunnelId})
}

func makeSubName(subName string, tunnelId string, cid string) string {
	return subName + "/" + tunnelId + "/" + cid
}

func handleMsg(c *ax.Client, msg *tunnelmsg, t *tunnel) {
	switch msg.Code {
	case msgKick:
		// got kick =>
		//	- create channel to msg/tunnelId/peerId
		//      - initiate OTR SMP session
		peerId := msg.Data.(string)
		msgsendch := make(chan *tunnelmsg)
		mqc.BindSendChan(makeSubName("msg", t.id, peerId), msgsendch)
		c.Context["msgsend"] = msgsendch
		sendSimpleInit(c, t.id, true)
	case msgSimpleData:
		sendSimpleData(c, t.id, msg.Data.(string))
	case msgSimpleDisconnect:
		sendSimpleDisconnect(c, t.id)
	}
}

func tunnelLoop(c *ax.Client, t *tunnel) {
	cmdch, ok1 := c.Context["cmdrecv"].(chan *tunnelmsg)
	serverch, ok2 := c.Context["srvrecv"].(chan *tunnelmsg)
	msgrecvch, ok3 := c.Context["msgrecv"].(chan *tunnelmsg)
	if !ok1 || !ok2 || !ok3 {
		log.Printf("tunnelLoop error: one of channels is not present\n")
		return
	}
	ticker := time.NewTicker(tunnelRefreshPeriod * time.Second)
	tunnelExpire(t.id)
	wg.Add(1)
	defer func() {
		wg.Done()
		endSimpleConversation(c)
		ticker.Stop()
		tunnelExpire(t.id)
	}()
	for {
		select {
		case msg := <-msgrecvch:
			handleMsg(c, msg, t)
		case cmd := <-cmdch:
			if cmd.Code == msgCmdShutdown {
				return
			}
		case servercmd := <-serverch:
			if servercmd.Code == msgCmdShutdown {
				c.Disconnect()
				return
			}
		case <-ticker.C: // refresh tunnel structures periodically
			tunnelExpire(t.id)
		}
	}
}

func beginSimpleConversation(c *ax.Client, t *tunnel, state int, peerId string) bool {
	// subscribe to "msg/<tunnelId>/<clientId>" (private mq for the client)
	msgrecvch := make(chan *tunnelmsg)
	sub, _ := mqc.BindRecvChan(makeSubName("msg", t.id, c.Cid()), msgrecvch)
	msgsub := mq.MakeSub(sub)
	// store the channel to the context
	c.Context["msgrecv"] = msgrecvch
	c.Context["msgsub"] = msgsub
	c.Context["cmdrecv"] = make(chan *tunnelmsg)
	// subscribe to server comand mq
	serverch := make(chan *tunnelmsg)
	sub, _ = mqc.BindRecvChan(serverChanName, serverch)
	srvrecvsub := mq.MakeSub(sub)
	c.Context["srvrecv"] = serverch
	c.Context["srvrecvsub"] = srvrecvsub
	if state == tunnelStateTalk {
		// create send chan
		msgsendch := make(chan *tunnelmsg)
		mqc.BindSendChan(makeSubName("msg", t.id, peerId), msgsendch)
		c.Context["msgsend"] = msgsendch
		// Kick peer
		msgsendch <- &tunnelmsg{msgKick, c.Cid()}
		// Send 'on_simple_init' to self
		sendSimpleInit(c, t.id, false)
	}
	stat.TunnelClientEnter()
	go tunnelLoop(c, t)
	return true
}

func endSimpleConversation(c *ax.Client) {
	tunnelId, ok := c.Context["tid"].(string)
	removePeerFromTunnel(tunnelId, c.Cid())
	msgsendch, ok := c.Context["msgsend"].(chan *tunnelmsg)
	if ok {
		// Notify remote peer we are leaving
		msgsendch <- &tunnelmsg{msgSimpleDisconnect, ""}
		close(msgsendch)
	}
	delete(c.Context, "msgsend")
	msgsub, ok := c.Context["msgsub"].(*mq.Sub)
	if ok {
		msgsub.Unsubscribe()
	}
	delete(c.Context, "msgsub")
	msgrecvch, ok := c.Context["msgrecv"].(chan *tunnelmsg)
	if ok {
		close(msgrecvch)
	}
	delete(c.Context, "msgrecv")
	cmdch, ok := c.Context["cmdrecv"].(chan *tunnelmsg)
	if ok {
		close(cmdch)
	}
	delete(c.Context, "cmdrecv")
	srvrecvsub, ok := c.Context["srvrecvsub"].(*mq.Sub)
	if ok {
		srvrecvsub.Unsubscribe()
	}
	delete(c.Context, "srvrecvsub")
	serverch, ok := c.Context["srvrecv"].(chan *tunnelmsg)
	if ok {
		close(serverch)
	}
	delete(c.Context, "srvrecv")
	stat.TunnelClientLeave()
}

func DoCleanup(c *ax.Client) {
	cmdch, ok := c.Context["cmdrecv"].(chan *tunnelmsg)
	if ok {
		cmdch <- &tunnelmsg{msgCmdShutdown, ""} // this will shut down simpleConversationLoop
	}
}

func KillAll() bool {
	mqc := mq.Connect(10)
	if mqc == nil {
		log.Printf("KillAll error: no mq\n")
		return false
	}
	defer mqc.Close()
	serverch := make(chan *tunnelmsg)
	defer close(serverch)
	err := mqc.BindSendChan(serverChanName, serverch)
	if err != nil {
		log.Printf("KillAll error: BindSendChan failed\n")
		return false
	}
	serverch <- &tunnelmsg{msgCmdShutdown, ""}
	wg.Wait()
	return true
}
