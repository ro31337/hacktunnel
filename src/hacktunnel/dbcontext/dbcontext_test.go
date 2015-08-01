// HackTunnel project
// (C) 2015 DevHQ, http://devhq.io
// License: AGPL 3

package dbcontext

import (
	"testing"
	"time"
)

type testPersonStruct struct {
	Id   int
	Name string
	City string
}

func testPut(t *testing.T) {
	p := testPersonStruct{Id: 1, Name: "Masha", City: "Moscow"}
	err := Put("user1", "context1", p)
	if err != nil {
		t.Fatal("set failed", err.Error())
	}
}

func testGet(t *testing.T) {
	var p testPersonStruct

	err := Get("user1", "context1", &p)
	if err != nil {
		t.Fatal("get failed", err.Error())
	}
	if p.Id != 1 || p.Name != "Masha" {
		t.Fatal("invalid deserialized data")
	}
}

func testFailGet(t *testing.T) {
	var p testPersonStruct

	err := Get("user1", "context1", &p)
	if err == nil {
		t.Fatal("get NOT failed (MUST FAIL)")
	}
}

func TestPutGetTimeout(t *testing.T) {
	DeleteBucket("user1")
	testPut(t)
	testGet(t)
	testPut(t)
	testGet(t)
	testPut(t)
	if err := Expire("user1", 1); err != nil {
		t.Fatal("timeout error", err.Error())
	}
	time.Sleep(time.Millisecond * 900)
	testGet(t)
	testPut(t)
	if err := Expire("user1", 1); err != nil {
		t.Fatal("timeout error", err.Error())
	}
	time.Sleep(time.Millisecond * 1100)
	testFailGet(t)
}

func TestSets(t *testing.T) {
	DeleteBucket("user2")
	ex, err := SetAdd("user2", []byte("foo"))
	if err != nil {
		t.Fatal(err)
	}
	if !ex {
		t.Fail()
	}
	ex, err = SetAdd("user2", []byte("foo"))
	if err != nil {
		t.Fatal(err)
	}
	if ex {
		t.Fail()
	}
	ex, err = SetAdd("user2", []byte("bar"))
	if err != nil {
		t.Fatal(err)
	}
	if !ex {
		t.Fail()
	}
	ex, err = SetAdd("user2", []byte("test"))
	if err != nil {
		t.Fatal(err)
	}
	if !ex {
		t.Fail()
	}
	s, err := RetrieveSetMembers("user2")
	if err != nil {
		t.Fatal(err)
	}
	if len(s) != 3 {
		t.Fail()
	}
	ok, err := SetRemove("user2", []byte("bar"))
	if !ok || err != nil {
		t.Fail()
	}
	s, err = RetrieveSetMembers("user2")
	if err != nil {
		t.Fatal(err)
	}
	if len(s) != 2 {
		t.Fail()
	}
}
