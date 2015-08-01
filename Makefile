# HackTunnel project
# (C) 2015 DevHQ, http://devhq.io
# License: AGPL 3

compile:
	./node_modules/less/bin/lessc ./static/less/style.less > ./static/css/style.css
	./node_modules/react-tools/bin/jsx ./static/js/etc/ui.js > ./static/js/etc/ui-translated.js
	@gb build || (echo 'Error. Try to run "make get-deps"' ; exit 1)

get-deps:
	go get -u github.com/constabulary/gb/...
	rm -rf ./vendor
	gb vendor fetch -no-recurse github.com/dchest/uniuri
	gb vendor fetch -no-recurse github.com/gorilla/mux
	gb vendor fetch -no-recurse github.com/gorilla/context
	gb vendor fetch -no-recurse github.com/gorilla/websocket
	gb vendor fetch -no-recurse github.com/scalingdata/gcfg
	gb vendor fetch -no-recurse github.com/hoisie/redis
	gb vendor fetch -no-recurse github.com/nats-io/nats
	gb vendor fetch -no-recurse github.com/devhq-io/ax
	gb vendor fetch -no-recurse github.com/devhq-io/endless
	gb vendor fetch -no-recurse github.com/cloudfoundry/gosigar
	npm install react-tools
	npm install --force bower
	npm install less
	./node_modules/bower/bin/bower install

delete-deps:
	rm -rf ./vendor
	rm -rf ./static/vendor
	rm -rf ./node_modules

run:
	bin/hacktunnel

clean:
	rm -f bin/hacktunnel
	rm -f ./static/css/style.css
	rm -f ./static/js/etc/ui-translated.js

