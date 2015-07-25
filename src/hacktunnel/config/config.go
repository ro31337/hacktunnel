// HackTunnel project
// (C) 2015 DevHQ, http://devhq.io
// License: AGPL 3

package config

import (
	"log"

	"github.com/scalingdata/gcfg"
)

type Config struct {
	LogType           string   `gcfg:"logtype"`
	HttpServerPort    int      `gcfg:"http-server-port"`
	HttpServerUseTls  bool     `gcfg:"http-server-use-tls"`
	RedirTo           string   `gcfg:"redir-to"`
	RedirFromPort     int      `gcfg:"redir-from-port"`
	ConnectionTimeout int      `gcfg:"connection-timeout"`
	Nats              []string `gcfg:"nats"`
	NatsUseTls        bool     `gcfg:"nats-use-tls"`
	RedisAddr         string   `gcfg:"redis-addr"`
	RedisDb           int      `gcfg:"redis-db"`
	RedisPassword     string   `gcfg:"redis-password"`
	TunnelLifetime    int64    `gcfg:"tunnel-lifetime-sec"`
}

type configFile struct {
	Hacktunnel Config
}

var config Config

func read(filename string) {
	var cf configFile
	err := gcfg.ReadFileInto(&cf, filename)
	if err != nil {
		log.Printf("Cannot read config file '%s'\n", filename)
		panic(err)
	}
	config = cf.Hacktunnel
	log.Printf("Configuration: %+v\n", config)
}

func C() *Config {
	return &config
}

func Init(path string) {
	read(path)
}
