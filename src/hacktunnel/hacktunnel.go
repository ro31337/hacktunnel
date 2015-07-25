// HackTunnel project
// (C) 2015 DevHQ, http://devhq.io
// License: AGPL 3

package main

import (
	"flag"
	"fmt"
	"hacktunnel/config"
	"hacktunnel/dbcontext"
	"hacktunnel/stat"
	"hacktunnel/tunnel"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path"
	"runtime/debug"
	"syscall"
	"time"

	"github.com/devhq-io/ax"
	"github.com/devhq-io/endless"
	"github.com/gorilla/mux"
)

var (
	tlsFilesPath    string = "."
	tlsCertFileName string = "tls-cert.pem"
	tlsKeyFileName  string = "tls.key"
	logFile         *os.File
)

func setupLogger(which string) {
	switch which {
	case "null":
		log.SetOutput(ioutil.Discard)
	case "stdout":
		log.SetOutput(os.Stdout)
	case "file":
		logFile, err := os.OpenFile("log.txt",
			os.O_RDWR|os.O_CREATE|os.O_APPEND, 0666)
		if err != nil {
			panic(err)
		}
		log.SetOutput(logFile)
	}
}

func startGcLoop(period time.Duration) {
	go func(period time.Duration) {
		for {
			debug.FreeOSMemory()
			time.Sleep(period * time.Second)
		}
	}(period)
}

func indexFileHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if config.C().HttpServerUseTls {
		w.Header().Set("Strict-Transport-Security",
			"max-age=31536000; includeSubDomains")
	}
	http.ServeFile(w, r, "./www/index.html")
}

func redirHandler(w http.ResponseWriter, req *http.Request) {
	http.Redirect(w, req, config.C().RedirTo+req.RequestURI,
		http.StatusMovedPermanently)
}

func setupRoutes(r *ax.Router) {
	r.StrictSlash(true)
	r.HandleFunc("/", indexFileHandler).Methods("GET")
	r.HandleFunc("/{tunnel_name}", indexFileHandler).Methods("GET")

	http.Handle("/", r)
}

func preSigHup() {
	log.Printf("Got SIGHUP signal: hot code reload\n")
}

func preSigInt() {
	log.Printf("Got SIGTERM signal\n")
	// server will be shut down in 10 sec
	endless.DefaultHammerTime = 10 * time.Second
	tunnel.KillAll()
	log.Printf("All clients were shut down\n")
	tunnel.Shutdown()
}

/*
 * Stopping the server:
 * - hot code reloading: kill -SIGHUP `pidof hacktunnel`
 * - shutdown all clients gracefully: kill -SIGINT `pidof hacktunnel`
 */

func redir() {
	port := config.C().RedirFromPort
	if port == 0 {
		port = 80
	}
	log.Printf("Serving %d for redirection\n", port)
	addr := fmt.Sprintf(":%d", port)
	r := mux.NewRouter()
	r.HandleFunc("/hello", redirHandler).Methods("GET")
	srv := endless.NewServer(addr, r)
	log.Println(srv.ListenAndServe())
}

func start(r *ax.Router, port int, usetls bool) {
	log.Printf("Serving %d, use TLS: %v\n", port, usetls)
	addr := fmt.Sprintf(":%d", port)
	srv := endless.NewServer(addr, nil)
	srv.SignalHooks[endless.PRE_SIGNAL][syscall.SIGHUP] = append(
		srv.SignalHooks[endless.PRE_SIGNAL][syscall.SIGHUP],
		preSigHup)
	srv.SignalHooks[endless.PRE_SIGNAL][syscall.SIGINT] = append(
		srv.SignalHooks[endless.PRE_SIGNAL][syscall.SIGINT],
		preSigInt)
	endless.DefaultHammerTime = -1 // disable hammering the server
	if usetls {
		certfname := path.Join(tlsFilesPath, tlsCertFileName)
		keyfname := path.Join(tlsFilesPath, tlsKeyFileName)
		if config.C().RedirTo != "" {
			go redir()
		}
		log.Println(srv.ListenAndServeTLS(certfname, keyfname))
	} else {
		log.Println(srv.ListenAndServe())
	}
}

func setMessageHandlers() {
	ax.OnEnter(onEnter)
	ax.OnLeave(onLeave)
	ax.OnJson("query_tunnel", tunnel.OnQueryTunnel)
	ax.OnJson("enter_tunnel", tunnel.OnEnterTunnel)
	ax.OnJson("leave_tunnel", onLeaveTunnel)
	ax.OnJson("simple_send", tunnel.OnSimpleSend)
}

func init() {
	var configName string
	flag.StringVar(&configName, "config", "hacktunnel.conf", "configuration file")
	flag.Parse()
	config.Init(configName)
	dbcontext.Init()
	stat.Init()
	tunnel.Init()
}

func main() {
	port := config.C().HttpServerPort
	connTimeout := config.C().ConnectionTimeout
	logtype := config.C().LogType
	if logtype == "" {
		logtype = "stdout"
	}
	setupLogger(logtype)
	startGcLoop(1000)
	usetls := config.C().HttpServerUseTls
	c := &ax.Config{ConnectionTimeout: connTimeout, UseTls: usetls}
	r := ax.Setup(c)
	setupRoutes(r)
	setMessageHandlers()
	start(r, port, usetls)
}

// *** Message handlers ***

func onEnter(c *ax.Client, r *http.Request) {
	stat.ClientEnter()
}

func onLeave(c *ax.Client) {
	tunnel.DoCleanup(c)
	stat.ClientLeave()
}

func onLeaveTunnel(c *ax.Client, _ interface{}) {
	tunnel.DoCleanup(c)
}
