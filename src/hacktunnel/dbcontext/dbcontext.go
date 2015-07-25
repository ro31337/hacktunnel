// HackTunnel project
// (C) 2015 DevHQ, http://devhq.io
// License: AGPL 3

package dbcontext

import (
	"bytes"
	"encoding/gob"
	"hacktunnel/config"
	"log"

	"github.com/hoisie/redis"
)

var (
	debug  bool = false
	client redis.Client
)

func Init() {
	client.Addr = config.C().RedisAddr
	client.Db = config.C().RedisDb
	client.Password = config.C().RedisPassword
}

func redisKeyName(id string) string {
	return "c:" + id
}

func gobEncode(val interface{}) *bytes.Buffer {
	var buf bytes.Buffer
	enc := gob.NewEncoder(&buf)
	err := enc.Encode(val)
	if err != nil {
		log.Fatalf("gob encode error: %+v\n", err)
	}
	return &buf
}

func gobDecode(buf *bytes.Buffer, val interface{}) error {
	return gob.NewDecoder(buf).Decode(val)
}

func Debug(on bool) {
	debug = on
}

// Set context value for specified user
// id: ID of the user
// key: key insude user's context
// val: value to set
func Put(id string, key string, val interface{}) error {
	buf := gobEncode(val)
	rkeyname := redisKeyName(id)
	_, err := client.Hset(rkeyname, key, buf.Bytes())
	if err != nil {
		log.Printf("hset error: %+v\n", err)
		return err
	}
	if debug {
		log.Printf("HSET '%s' '%s' '%s'\n", rkeyname, key, string(buf.Bytes()))
	}
	return nil
}

// Get context value for specified user
// id: ID of the user
// key: key insude user's context
// val: read and deserialized value
func Get(id string, key string, val interface{}) error {
	rkeyname := redisKeyName(id)
	data, err := client.Hget(rkeyname, key)
	if err != nil {
		return err
	}
	if debug {
		log.Printf("HGET '%s' '%s' -> '%s'\n", rkeyname, key, string(data))
	}
	return gobDecode(bytes.NewBuffer(data), val)
}

func Del(id string, key string) (bool, error) {
	rkeyname := redisKeyName(id)
	return client.Hdel(rkeyname, key)
}

func SetAdd(id string, val []byte) (bool, error) {
	rkeyname := redisKeyName(id)
	return client.Sadd(rkeyname, val)
}

func RetrieveSetMembers(id string) ([][]byte, error) {
	rkeyname := redisKeyName(id)
	return client.Smembers(rkeyname)
}

func SetRemove(id string, val []byte) (bool, error) {
	rkeyname := redisKeyName(id)
	return client.Srem(rkeyname, val)
}

// Set timeout for the context of specified user
// id: ID of the user
// time: time to expire, seconds
func Expire(id string, time int64) error {
	_, err := client.Expire(redisKeyName(id), time)
	if err != nil {
		log.Printf("expire error: %+v\n", err)
	}
	return err
}
