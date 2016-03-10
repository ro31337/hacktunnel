# HackTunnel project
# (C) 2015 DevHQ, http://devhq.io
# License: AGPL 3

compile:
	./node_modules/less/bin/lessc ./static/less/style.less > ./static/css/style.css
	./node_modules/react-tools/bin/jsx ./static/js/etc/ui.js > ./static/js/etc/ui-translated.js
	@gb build || (echo 'Error. Try to run "make get-deps"' ; exit 1)

test:
	@gb test

get-deps:
	go get -u github.com/constabulary/gb/...
	@gb vendor restore
	npm install react-tools
	npm install --force bower
	npm install less
	./node_modules/bower/bin/bower install

delete-deps:
	rm -rf ./vendor/src
	rm -rf ./static/vendor
	rm -rf ./node_modules

run:
	bin/hacktunnel

clean:
	rm -f bin/hacktunnel
	rm -f ./static/css/style.css
	rm -f ./static/js/etc/ui-translated.js

