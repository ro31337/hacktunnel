// HackTunnel project
// (C) 2015 DevHQ, http://devhq.io
// License: AGPL 3

package tunnel

import (
	"hacktunnel/config"
	"hacktunnel/dbcontext"
	"hacktunnel/stat"
	"hacktunnel/util"
	"log"

	"github.com/dchest/uniuri"
	"github.com/devhq-io/ax"
)

const (
	tunnelRefreshPeriod = 300

	tunnelFlagsHasPassword = 0x00000001

	tunnelStateWait          = 1 // another peer still has not connected. wait
	tunnelStateTalk          = 2 // both peers have connected. let's talk
	tunnelStateOccupied      = 3 // we are third peer => access is denied
	tunnelStateAlreadyMember = 4 // we are already a member of this tunnel
)

type tunnel struct {
	id string
}

type statusArgs struct {
	Status string `json:"status"`
	Id     string `json:"id"`
}

func sendStatus(c *ax.Client, msgtype string, id string, status string) {
	c.JsonSend(msgtype,
		&statusArgs{Status: status, Id: id})
}

func sendOnEnterTunnelOk(c *ax.Client, id string, created bool) {
	c.JsonSend("on_enter_tunnel",
		&struct {
			Status  string `json:"status"`
			Id      string `json:"id"`
			Created bool   `json:"created"`
		}{"ok", id, created})
}

func newTunnelId() string {
	return uniuri.NewLen(6)
}

func queryTunnelById(id string) (*tunnel, error) {
	var tunnelId string
	tunnelIdKey := getTunnelIdKey(id)
	err := dbcontext.Get(tunnelIdKey, "id", &tunnelId)
	if err != nil {
		return nil, err
	}
	if tunnelId != id {
		panic("Error: incorrect tunnel DB record")
	}
	return &tunnel{
		id: id,
	}, nil
}

func isReservedUrl(url string) bool {
	return url == "about"
}

func generateNotExistingTunnelId() string {
	var id string
	for {
		id = newTunnelId()
		if isReservedUrl(id) {
			continue
		}
		_, err := queryTunnelById(id)
		if err != nil {
			break
		}
	}
	return id
}

func getTunnelIdKey(id string) string { return "ti:" + id }

func getTunnelSetKey(id string) string { return "ts:" + id }

func tunnelExpire(tunnelId string) error {
	tunnelIdKey := getTunnelIdKey(tunnelId)
	tunnelLifetime := config.C().TunnelLifetime
	if tunnelLifetime == 0 {
		tunnelLifetime = 600
	}
	return dbcontext.Expire(tunnelIdKey, tunnelLifetime)
}

// Determine state of the tunnel with current peer taken into account.
// returns state and (if state is tunnelStateTalk) another peer's id
func determineTunnelState(cid string, tunnelId string) (int, string) {
	// Get count of peers in the tunnel
	tunnelSetKey := getTunnelSetKey(tunnelId)
	a, err := dbcontext.RetrieveSetMembers(tunnelSetKey)
	if err != nil {
		log.Printf("Error: cannot retrieve set '%s'\n", tunnelSetKey)
		return tunnelStateOccupied, ""
	}
	// check if `cid` is already a member
	for _, memberCid := range a {
		if cid == string(memberCid) {
			return tunnelStateAlreadyMember, ""
		}
	}
	// At least two => this tunnel is occupied
	if len(a) >= 2 {
		return tunnelStateOccupied, ""
	}
	var ret int
	var peerId string
	if len(a) == 1 {
		// Another peer is waiting for us to begin talk
		peerId = string(a[0])
		ret = tunnelStateTalk
	} else {
		// We are the first peer on the tunnel. Wait for another peer
		peerId = ""
		ret = tunnelStateWait
	}
	return ret, peerId
}

func tunnelHasPassword(tunnelId string) bool {
	tunnelIdKey := getTunnelIdKey(tunnelId)
	var np string
	err := dbcontext.Get(tunnelIdKey, "np", &np)
	return !(err == nil && np == "1")
}

func addToTunnel(cid string, tunnelId string) {
	tunnelSetKey := getTunnelSetKey(tunnelId)
	dbcontext.SetAdd(tunnelSetKey, []byte(cid))
}

func setNoPassword(tunnelId string) {
	tunnelIdKey := getTunnelIdKey(tunnelId)
	// Tunnels have passwords by default
	dbcontext.Put(tunnelIdKey, "np", "1")
}

func removePeerFromTunnel(tunnelId string, cid string) {
	tunnelSetKey := getTunnelSetKey(tunnelId)
	_, err := dbcontext.SetRemove(tunnelSetKey, []byte(cid))
	if err != nil {
		log.Printf("removePeerFromTunnel error: %+v\n", err)
	}
	state, _ := determineTunnelState(cid, tunnelId)
	if state == tunnelStateWait {
		dbcontext.Del(getTunnelIdKey(tunnelId), "np")
	}
}

func sendOnRequestTunnel(c *ax.Client, name string, id string, ownerId string) {
	args := &struct {
		Status  string `json:"status"`
		Name    string `json:"name"`
		Id      string `json:"id"`
		OwnerId string `json:"owner_id"`
	}{
		Status:  "ok",
		Name:    name,
		Id:      id,
		OwnerId: ownerId,
	}
	c.JsonSend("on_request_tunnel", args)
}

func createTunnel(id string) *tunnel {
	if id == "" {
		id = generateNotExistingTunnelId()
	}
	t := &tunnel{id: id}
	tunnelIdKey := getTunnelIdKey(t.id)
	dbcontext.Put(tunnelIdKey, "id", t.id)
	tunnelExpire(t.id)
	stat.TunnelCreate()
	return t
}

func OnQueryTunnel(c *ax.Client, data interface{}) {
	create := false
	tunnelId, err := util.GetStringField(data, "id")
	var t *tunnel
	if err != nil {
		tunnelId = ""
		create = true
	} else {
		// Does requested tunel exist?
		t, err = queryTunnelById(tunnelId)
		if err != nil {
			create = true
		}
	}
	if create {
		t = createTunnel(tunnelId)
		tunnelId = t.id
		sendStatus(c, "on_query_tunnel", tunnelId, "empty")
		return
	}
	if t == nil {
		log.Printf("OnQueryTunnel error: race condition when creating tunnel")
		sendStatus(c, "on_query_tunnel", tunnelId, "internal_error")
		return
	}
	// The tunnel exists. Check tunnel state
	state, _ := determineTunnelState(c.Cid(), tunnelId)
	var status string
	switch state {
	case tunnelStateAlreadyMember:
		status = "already_member"
	case tunnelStateOccupied:
		status = "occupied"
	case tunnelStateWait:
		status = "empty"
	case tunnelStateTalk:
		if !tunnelHasPassword(tunnelId) {
			status = "nopass"
		} else {
			status = "pass"
		}
	default:
		log.Printf("OnQueryTunnel invalid state %d\n", state)
		status = "internal_error"
	}
	sendStatus(c, "on_query_tunnel", tunnelId, status)
}

// Enter tunnel
// Try to estabilish a communication with the peer
// If unsuccessful, enter wait state
func OnEnterTunnel(c *ax.Client, data interface{}) {
	tunnelId, err1 := util.GetStringField(data, "id")
	flags, err2 := util.GetInt64Field(data, "flags")
	if err1 != nil || err2 != nil {
		sendStatus(c, "on_enter_tunnel", "", "invalid")
		return
	}
	t, err := queryTunnelById(tunnelId)
	if err != nil {
		t = createTunnel(tunnelId)
		tunnelId = t.id
	}
	// Got the tunnel. Let's try to initiate a conversation
	state, peerId := determineTunnelState(c.Cid(), tunnelId)
	switch state {
	case tunnelStateOccupied:
		sendStatus(c, "on_enter_tunnel", tunnelId, "occupied")
	case tunnelStateWait, tunnelStateTalk:
		addToTunnel(c.Cid(), tunnelId)
		if state == tunnelStateWait && (flags&tunnelFlagsHasPassword) == 0 {
			setNoPassword(tunnelId)
		}
		if beginSimpleConversation(c, t, state, peerId) {
			c.Context["tid"] = tunnelId
			sendOnEnterTunnelOk(c, tunnelId, state == tunnelStateWait)
		} else {
			sendStatus(c, "on_enter_tunnel", tunnelId, "internal_error")
		}
	case tunnelStateAlreadyMember:
		sendStatus(c, "on_enter_tunnel", tunnelId, "already_member")
	default:
		log.Fatalf("OnEnterTunnel invalid state %d", state)
	}
}

func OnSimpleSend(c *ax.Client, inputData interface{}) {
	tunnelId, err := util.GetStringField(inputData, "id")
	if err != nil {
		log.Println("DoSimpleSend error:", err)
		sendStatus(c, "on_simple_error", "", "invalid")
		return
	}
	data, err := util.GetStringField(inputData, "data")
	if err != nil {
		log.Println("DoSimpleSend error:", err)
		sendStatus(c, "on_simple_error", tunnelId, "invalid")
		return
	}
	// redirect to peer
	ch, ok := c.Context["msgsend"].(chan *tunnelmsg)
	if ok {
		ch <- &tunnelmsg{msgSimpleData, data}
	}
}
