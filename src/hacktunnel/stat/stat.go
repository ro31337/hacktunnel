// HackTunnel project
// (C) 2015 DevHQ, http://devhq.io
// License: AGPL 3

// Statistics module
package stat

import (
	"encoding/json"
	"fmt"
	"hacktunnel/mq"
	"log"
	"runtime"
	"sync/atomic"
	"time"

	"github.com/cloudfoundry/gosigar"
)

var (
	clientNum          int64
	tunnelClientNum    int64
	tunnelsEverCreated int64
	startTime          time.Time
)

func init() {
	startTime = time.Now()
	atomic.StoreInt64(&clientNum, 0)
	atomic.StoreInt64(&tunnelClientNum, 0)
	atomic.StoreInt64(&tunnelsEverCreated, 0)
}

func TunnelCreate() {
	atomic.AddInt64(&tunnelsEverCreated, 1)
}

func ClientEnter() {
	atomic.AddInt64(&clientNum, 1)
}

func ClientLeave() {
	atomic.AddInt64(&clientNum, -1)
}

func TunnelClientEnter() {
	atomic.AddInt64(&tunnelClientNum, 1)
}

func TunnelClientLeave() {
	atomic.AddInt64(&tunnelClientNum, -1)
}

type Statistics struct {
	Time               string           `json:"time"`
	SrvUptime          string           `json:"srv_uptime"`
	SysUptime          string           `json:"sys_uptime"`
	SysAvgLoad         string           `json:"sys_avg_load"`
	ClientNum          int64            `json:"client_num"`
	TunnelClientNum    int64            `json:"tunnel_client_num"`
	TunnelsEverCreated int64            `json:"tunnels_ever_created"`
	NumCpu             int              `json:"numcpu"`
	NumGoroutine       int              `json:"fibers"`
	Mem                runtime.MemStats `json:"mem"`
}

func getTime() string {
	return time.Now().UTC().Format("Jan 2, 2006 at 3:04pm (MST)")
}

func getServerUptime() string {
	d := time.Since(startTime)
	return fmt.Sprintf("%s (%f days)", d.String(), d.Hours()/24)
}

func getSystemUptime() string {
	uptime := sigar.Uptime{}
	uptime.Get()
	return uptime.Format()
}

func getSystemAverageLoad() string {
	avg := sigar.LoadAverage{}
	avg.Get()
	return fmt.Sprintf("%.2f, %.2f, %.2f", avg.One, avg.Five, avg.Fifteen)
}

func statService() ([]byte, error) {
	s := Statistics{
		Time:               getTime(),
		SrvUptime:          getServerUptime(),
		SysUptime:          getSystemUptime(),
		SysAvgLoad:         getSystemAverageLoad(),
		ClientNum:          clientNum,
		TunnelClientNum:    tunnelClientNum,
		TunnelsEverCreated: tunnelsEverCreated,
		NumCpu:             runtime.NumCPU(),
		NumGoroutine:       runtime.NumGoroutine(),
	}
	runtime.ReadMemStats(&s.Mem)
	return json.Marshal(s)
}

func Init() {
	c := mq.Connect(10)
	_, err := c.Subscribe("stat", func(replyMq string) {
		data, err := statService()
		var reply string
		if err != nil {
			reply = fmt.Sprintf("{error: '%v'}", err)
		} else {
			reply = string(data)
		}
		c.Publish(replyMq, reply)
	})
	if err != nil {
		log.Printf("stat Init error: Subscribe failed\n")
	}
}
