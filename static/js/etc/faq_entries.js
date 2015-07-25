// HackTunnel project
// (C) 2015 DevHQ, http://devhq.io
// License: AGPL 3

var faq_entries = [
    {
        q: 'What is HackTunnel?',
        a: 'HackTunnel is an anonymous and encrypted in-browser one-to-one chat.'
    },
	{
        q: "What's under the hood?",
        a: 'Encryption is implemented on client side with OTR '+
            'algorithm (<a href="https://github.com/arlolra/otr">otr.js</a> JavaScript library). '+
            'The second level of encryption is TLS which is supported by the browser. ' +
            'The back end is powered by Go language, Redis database and '+
            'NATS messaging library. It is easily scalable in '+
            'the case of heavy workload. The project is fully '+
            'open-sourced.'
    },
	{
        q: "How can I use HackTunnel?",
        a: "Navigate to https://hacktunnel.com or https://hacktunnel.com/my_unique_tunnel_name. Enter pre-shared passphrase (recommended) and click \"Start\". Share your browser's url address with your friend. And here you go, chat room is created and ready to use."
    },
	{
        q: 'Why do I need to enter the passphrase?',
        a: 'Hacktunnel uses <a href="https://en.wikipedia.org/wiki/Socialist_millionaire">"Socialist Millionaire" algorithm</a> which makes man-in-the-middle attack on your conversation nearly impossible.'
    },
    {
        q: 'How safe is my tunnel?',
        a: 'Your tunnel remains safe until your password or our servers are not compromised. We keep an eye on our servers security and will inform you on index page of any suspicious activity. Our software is open-sourced and can be reviewed by anyone. For better security we recommended to deploy the software to your own server. We highly recommend to use strong passwords.'
    },
    {
        q: 'How can I ensure that my messages are encrypted?',
        a: "Just press F12 and you will see what's on the wire."
    },
    {
        q: 'How can I believe JavaScript code from the server is not compromised?',
        a: "JavaScript from the server can easily be checked against the source code. We don't use minify/uglify technique for our JavaScript code as well. TLS usage extremely hardens the task of hijacking the code on-the-fly. However, if you do not trust our server, you can set up yours."
    },
    {
        q: 'Is it free?',
        a: 'HackTunnel is free for personal use. You can easily integrate our technology with your product. Let us know if you need commercial license (URL).'
    },
    {
        q: 'Do you keep chat history?',
        a: "No. Chat history is kept only in your and peer's browser."
    },
    {
        q: 'How reliable/scalable is your software?',
        a: "The server can easily keep 10000 connections on Linux or FreeBSD VM with 512MB memory."
    }
];
