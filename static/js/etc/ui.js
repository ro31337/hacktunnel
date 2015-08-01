// HackTunnel project
// (C) 2015 DevHQ, http://devhq.io
// License: AGPL 3

(function () {

'use strict';

function getRoot() { return document.getElementById('main'); }

var req_meta = cdn.getRequestTunnelViewMetadata();

function setupGraphics1() {
    $('.slogan').css('color', req_meta.opts.slogan_color);
    $('.error-text').css('color', req_meta.opts.slogan_color);
    $.backstretch(req_meta.background_url);
    $('.backstretch').toggle(true);
    $('body').css('height', '');
    $('#main').css('height', '');
}

function setupGraphics2() {
    var meta = cdn.getTalkViewMetadata();
    $.backstretch(meta.background_url);
    $('body').css('height', '100%');
    $('#main').css('height', '100%');
}

var Logo = React.createClass({
    render: function () {
        return (
            <div className="row">
                <h1 className="logo headline uppercase text-center">HackTunnel</h1>
                {
                    this.props.slogan ?
                        <p className="slogan text-center">Secure Communication Made Easy</p>
                        : null
                }
            </div>
            );
    }
});

var Progress = React.createClass({
    componentDidMount: function () {
        if (this.props.style === undefined)
            $('.progress-text').css('color', req_meta.opts.slogan_color);
    },
    render: function () {
        var style = this.props.style;
        if (style === undefined)
            style = {};
        return (
            <div className="media">
                <div className="img-circle media-object">
                    <div className="loading-indicator">
                        <svg viewBox="0 0 41 41">
                            <path d="M38,20.5 C38,30.1685093 30.1685093,38 20.5,38"></path>
                        </svg>
                    </div>
                </div>
                {
                    this.props.msg ?
                        <div className="media-body">
                            <h4 className="progress-text" style={style}>{this.props.msg}</h4>
                        </div>
                    : null
                }
            </div>
            );
    }
});

var ReconnectView = React.createClass({
    showRequestView: function () {
        React.render(<RequestTunnelView
                        state="waittunnel"
                        tunnel_id={this.props.tunnel_id}/>,
                getRoot());
    },
    handleReconnectError: function () {
        setTimeout(this.timer, this.props.timeout);
    },
    timer: function () {
        ax.onError(this.handleReconnectError);
        ax.connect(this.showRequestView);
    },
    componentDidMount: function () {
        $('body').css('background-color', '#f0f0f0');
        $('.progress-text').css('color', '#000000');
        ee.removeEvent('!disconnect');
        ee.addListener('!disconnect', function () {
            core.closeTunnel(this.props.tunnel_id);
        }.bind(this));
        setTimeout(this.timer, this.props.timeout);
    },
    render: function () {
        return (
<div className="index-page">
    <div className="jumbotron margin-top-120px">
        <div className="container">
            <Logo slogan={false} />
            <div className="row text-center">
                <Progress msg="The connection is broken, reconnecting..." />
            </div>
        </div>
    </div>
</div>
            );
    }
});

var TunnelErrorView = React.createClass({
    componentDidMount: function () {
        setupGraphics2();
    },
    render: function () {
        return (
<div className="index-page">
    <div className="jumbotron margin-top-120px">
        <div className="container">
            <Logo slogan={false} />
            <div className="row">
                <div className="text-center">
                    <p><span>{this.props.msg}</span></p>
                    {
                        this.props.hide_btn ? null :
                        <p><a href="/"><button type="submit" className="btn btn-primary btn-lg">New tunnel</button></a></p>
                    }
                </div>
            </div>
        </div>
    </div>
</div>
            );
    }
});

function enterPass(pass, tunnel_id) {
    core.enterTunnelPass(pass, tunnel_id).then(function (data) {
        switch (data.status) {
        case 'ok':
            React.render(<TalkView tunnel_id={tunnel_id} existing={!data.created}/>,
                        getRoot());
            break;
        case 'already_member':
            React.render(<TunnelErrorView msg="This tunnel is already opened in another window or tab"/>,
                        getRoot());
            break;
        case 'occupied':
            React.render(<TunnelErrorView msg="This tunnel is already occupied"/>, getRoot());
            break;
        default:
            React.render(<TunnelErrorView msg="Internal error"/>, getRoot());
            break;
        }
    });
}

var RequestTunnelView = React.createClass({
    getInitialState: function () {
        return {
            wait: false,
            tunnel_id: this.props.tunnel_id,
            show_tpass_input: false
        };
    },
    onQueryTunnel: function(data) {
        switch (data['status']) {
        case 'nopass':
            this.setState({wait: true});
            enterPass('', data['id']);
            break;
        case 'empty':
        case 'pass':
            redir('/' + data['id']);
            this.setState({tunnel_id: data['id'], show_tpass_input: true});
            setupReconnect(data['id']);
            setTimeout(function() { document.getElementById('tpass').focus(); }, 50);
            break;
        case 'already_member':
            React.render(<TunnelErrorView msg="This tunnel is already opened in another window or tab"/>,
                         getRoot());
            break;
        case 'occupied':
            React.render(<TunnelErrorView msg="This tunnel is already occupied"/>, getRoot());
            break;
        default:
            console.log('RequestTunnelView.onQueryTunnel error: invalid status: ' + data['status']);
        }
    },
    componentDidMount: function () {
        setupGraphics1();
        switch (this.props.state) {
        case 'waittunnel':
            core.queryTunnel(this.state.tunnel_id).then(this.onQueryTunnel);
            break;
        case 'reconnecting':
            this.setState({tunnel_id: this.props.tunnel_id, show_tpass_input: true});
            setupReconnect(this.props.tunnel_id);
            setTimeout(function() { document.getElementById('tpass').focus(); }, 50);
            break;
        default:
            console.log('RequestTunnelView.componentWillMount error: invalid state: ' + this.props.state);
        }
    },
    handleSubmitTunnelPass: function (e) {
        e.preventDefault();
        var tpass = document.getElementById('tpass').value;
        this.setState({wait: true});
        enterPass(tpass, this.state.tunnel_id);
    },
    render: function (data) {
        return (
<div className="index-page">

<div className="jumbotron margin-top-120px">
    <div className="container">

        <Logo slogan={true} />

    {
    this.state.show_tpass_input ?
        <div className="row">
            <form className="form-horizontal hidden-xs" onSubmit={this.handleSubmitTunnelPass}>
            <div className="form-group">
                <div className="col-xs-offset-2 col-xs-6 col-sm-offset-2 col-sm-6">
                    <input type="text" id="tpass" className="form-control input-lg"
                           placeholder="Passphrase (optional)" autoComplete="off" />
                </div>
                <button id="start_btn" className="btn btn-primary btn-lg col-xs-2 col-sm-2">Start</button>
            </div>
            </form>

            <form className="form-horizontal visible-xs" onSubmit={this.handleSubmitTunnelPass}>
            <div className="form-group">
                    <input type="text" id="tpass" className="form-control input-lg"
                           placeholder="Passphrase (optional)"  autoComplete="off"/>
                </div>
            <div className="form-group">
                <button id="start_btn" className="btn btn-primary btn-lg col-xs-12">Start</button>
            </div>
            </form>
        </div>
    :
        null
    }

        <div className="row">
            <div className="col-xs-12 text-center">
                { this.state.wait ? <Progress msg="Generating private key..."
                                    style={{fontWeight: '300', color: req_meta.opts.slogan_color}}/>
                                  : null }
            </div>
        </div>
        <div className="row">
            <div className="col-xs-12 text-center">
                { this.props.msg ? <h2 className="error-text">{this.props.msg}</h2> : null }
            </div>
        </div>


        <div className="row">
            {
            this.state.wait ? null :
            <div className="col-xs-12 text-center footer margin-top-150px">
                <a className="slogan" href="/about">About</a> | <a className="slogan" href="https://github.com/devhq-io/hacktunnel" target="_blank">Github</a> | <a className="slogan" href="http://devhq.io" target="_blank" title="Made in DevHQ">DevHQ</a>
            </div>
            }
        </div>

    </div>
</div>

</div>
            );
    }
});

var FaqEntry = React.createClass({
    render: function () {
        return (
<div>
    <p className="q">{this.props.entry.q}</p>
    <p className="a" dangerouslySetInnerHTML={{__html:this.props.entry.a}}></p>
</div>
            );
    }
});

var AboutView = React.createClass({
    componentDidMount: function () {
        $('.tunnel-page').css('background-image', '');
        $('.tunnel-page').css('background-color', '#ffffff');
    },
    render: function () {
        var faq = faq_entries;

        return (
<div className="tunnel-page">
<div className="header container navbar navbar-fixed-top">
  <div className="row">
    <div className="logo col-md-2 hidden-xs hidden-sm">
      <a href="/">HackTunnel</a>
    </div>
  </div>
</div>

<div className="wrap">
  <div  className="container">
    <section className="row">
      <div className="col-xs-offset-1 col-xs-10 faq">
        {
            faq.map(function (e) {
                return <FaqEntry entry={e} />
            })
        }
      </div>
    </section>
  </div>
</div>
</div>
        );

    }
});

var TalkViewHeader = React.createClass({
    getInitialState: function () {
        return { url: 'https://hacktunnel.com/' + this.props.tunnel_id };
    },
    setupZeroClipboard: function () {
        lib.setupZeroClipboard().then(function (clipboard_text) {
        });
    },
    componentDidMount: function () {
        if (lib.isZeroClipboardSupported()) {
            this.setupZeroClipboard();
        } else {
            var btn = document.getElementById('copy-btn');
            if (!btn)
                return;
            btn.parentNode.removeChild(btn);
        }
        // #tunnelid: select text on focus
        $('#tunnelid').click(function () {
            $(this).select();
        });
    },
    handleCloseTunnel: function (e) {
        core.closeTunnel(this.props.tunnel_id);
        React.render(<RequestTunnelView
                            state="reconnecting"
                            tunnel_id={this.props.tunnel_id}/>,
                     getRoot());
    },
    render: function () {
        return (
<div className="header container navbar navbar-fixed-top">
  <div className="row">
    <div className="logo col-md-2 hidden-xs hidden-sm">
      <a href="/">HackTunnel</a>
    </div>

    <div className="col-xs-8 col-md-6">
      <div className="form-group">
        <div className="url-container col-xs-10 col-md-11">
          <input id="tunnelid" className="form-control form-control-yeti-reduced-height monospace" value={this.state.url} readOnly/>
        </div>
        <div className="col-xs-2 col-md-1">
          <button id="copy-btn" className="btn btn-primary" data-clipboard-target="tunnelid">
            <i className="glyphicon glyphicon-copy"></i>
          </button>
        </div>
      </div>
    </div>

    <div className="col-xs-4 text-right">
      <button className="btn btn-primary cursor-ptr" onClick={this.handleCloseTunnel}>
        <i className="glyphicon glyphicon-off"></i> Close</button>
    </div>
  </div>
</div>
            );
    }
});

var WaitMessage = React.createClass({
    render: function () {
        return (<p>{this.props.msg}</p>);
    }
});

var WaitForTalk = React.createClass({
    getInitialState: function () {
        return {
            msgs: []
        };
    },
    handleWaitMsg: function (data) {
        var msgs = this.state.msgs;
        msgs.push(data);
        this.setState({msgs: msgs});
    },
    componentDidMount: function () {
        ee.addListener('!waitmsg', this.handleWaitMsg);
    },
    componentWillUnmount: function () {
        ee.removeListener('!waitmsg', this.handleWaitMsg);
    },
    render: function () {
        var waitmsg = this.props.existing ?
            'You are entering existing tunnel, please wait' :
            'Waiting for remote peer to enter the tunnel...';
        return (
  <div id="WaitForTalk" className="container">
    <section className="row">
      <div className="text-center" style={{marginTop: '100px'}}>
        <Progress msg={waitmsg} style={{color: '#000000', fontSize: '2em'}} />
        <p>
            {
                this.state.msgs.map(function (msg) {
                    return <WaitMessage msg={msg} />
                })
            }
        </p>
      </div>
    </section>
  </div>
            );
    }
});

var TalkMessage = React.createClass({
    render: function () {
        return (
            <div>
                <div className={
                        this.props.type === 'me' ? "from-me" :
                        this.props.type === 'them' ? "from-them" : "from-app-info"}>
                    <p>{this.props.text}</p>
                    <span className="timestamp">{this.props.time}</span>
                </div>
                <div className="clear"></div>
            </div>
            );
    }
});

function onlineStatusMessage(status) {
    var text;
    if (status === 'online')
        text = 'The peer is online';
    else
        text = 'The peer went offline';
    return text;
}

var Talk = React.createClass({
    getInitialState: function () {
        return {
            msgs: [],
            status: 'online'
        };
    },
    handleOtrText: function (data) {
        this.renderMessage('them', data.text);
        notify.show('HackTunnel', data.text);
    },
    handleTalkStatus: function(status) {
        this.setState({status: status});
        this.renderMessage('status', onlineStatusMessage(status));
        if (status === 'online')
            document.getElementById('inputmsg').focus();
    },
    componentDidMount: function () {
        ee.addListener('!otr_text', this.handleOtrText);
        ee.addListener('!talk_status', this.handleTalkStatus);
        document.getElementById('inputmsg').focus();
    },
    componentWillUnmount: function () {
        ee.removeListener('!otr_text', this.handleOtrText);
        ee.removeListener('!talk_status', this.handleTalkStatus);
    },
    renderMessage: function (type, text) {
        this.state.msgs.push({type: type, text: text, time: lib.timeNow(),
                              id: this.state.msgs.length});
        this.setState({msgs: this.state.msgs});
        // we must scroll a bit after rendering
        setTimeout(function () {
            $("#scrollable").scrollTop($('#scrollable')[0].scrollHeight + 1000);
        }, 100);
    },
    handleTalkInputSubmit: function (e) {
        e.preventDefault();
        var text = document.getElementById('inputmsg').value;
        if (text.length !== 0) {
            core.enterMessage(this.props.tunnel_id, text);
            this.renderMessage('me', text);
        }
        this.setState({inputtext: ''});
    },
    handleInputChange: function (e) {
        this.setState({inputtext: e.target.value});
    },
    render: function () {
        return (
  <div id="Talk" className="talk">
    <header></header>
    <article id="scrollable" className="container talk-main-panel">
      <div className="row">

        <div className="col-xs-12">
          <div id="msglist">
              {
                  this.state.msgs.map(function (msg) {
                      return <TalkMessage
                                  key={msg.id}
                                  type={msg.type}
                                  time={msg.time}
                                  text={msg.text}/>
                  })
              }
          </div>
        </div>

      </div>
    </article>
    <footer className="talk-bottom-panel">

      <div className="container">
        <div className="row">
          <div className="col-xs-12">

          <form onSubmit={this.handleTalkInputSubmit}>
            <input type="text" id="inputmsg" value={this.state.inputtext}
                   onChange={this.handleInputChange}
                   placeholder={this.state.status === 'online' ? "Start typing here..." : ""}
                   autoComplete="off" maxLength="16384"
                   readOnly={this.state.status != 'online'} />
          </form>

          </div>
        </div>
      </div>

    </footer>
  </div>
            );
    }
});

var TalkView = React.createClass({
    getInitialState: function () {
        return {
            waiting: true
        };
    },
    notifyTalk: function(status) {
        ee.emit('!talk_status', status);
    },
    handleOtrTrust: function (data) {
        if (data.trusted) {
            if (!this.state.waiting) {
                this.notifyTalk('online');
                notify.show('HackTunnel', onlineStatusMessage('online'));
            }
            this.setState({waiting: false, tunnel_id: data.tunnel_id});

            // On disconnect, wait again
            var handleRemoteDisconnect = function (_) {
                ee.removeEvent('!remote_disconnect');
                this.notifyTalk('offline');
                notify.show('HackTunnel', onlineStatusMessage('offline'));
            }.bind(this);
            ee.removeEvent('!remote_disconnect');
            ee.addListener('!remote_disconnect', handleRemoteDisconnect);

        } else {
            if (data.init_converation) {
                // Remote part has failed to enter the right pass.
                // Show message and stay here.
                ee.emit('!waitmsg', 'Remote peer has entered invalid passphrase!');
            } else {
                // We are not an initiator of the conversation and we have
                // entered an invalid passphrase. Get out and go back to
                // request view.
                React.render(
                    <RequestTunnelView
                        state="reconnecting"
                        tunnel_id={this.props.tunnel_id}
                        msg="Invalid passphrase. Try again please"/>,
                    getRoot());
            }
        }
    },
    componentDidMount: function () {
        ee.addListener('!otr_trust', this.handleOtrTrust);
        setupGraphics2();
        setupReconnect(this.props.tunnel_id);
        notify.authorize();
    },
    componentWillUnmount: function () {
        ee.removeListener('!otr_trust', this.handleOtrTrust);
    },
    render: function () {
        return (
<div className="tunnel-page">
            {
                this.state.waiting ?
                    <div className="wrap">
                        <TalkViewHeader tunnel_id={this.props.tunnel_id}/>
                        <WaitForTalk existing={this.props.existing}/>
                    </div>
                :
                    <div className="wrap">
                        <TalkViewHeader tunnel_id={this.props.tunnel_id}/>
                        <Talk tunnel_id={this.props.tunnel_id}/>
                    </div>
            }
</div>
        );
    }
});

var dynamic_url;

// TODO Add support for IE11. WebSockets are not working on IE11 wth HTTPS
function checkForUnsupportedBrowser() {
    var ret = lib.isIEBrowser();
    if (ret)
        React.render(
            <TunnelErrorView
                    hide_btn={true}
                    msg="Sorry, Internet Explorer is not supported due to lack of websockets HTTPS support for this browser. We're working on workaround, use other browsers for now"/>,
                    getRoot());
    return ret;
}

page('/about', function (context) {
    React.render(<AboutView />, getRoot());
});

page('/:tunnel_id', function (context) {
    if (checkForUnsupportedBrowser())
        return;
    var tunnel_id = context.params.tunnel_id;
    // Handle dynamic URL change in the address line (redir())
    if (dynamic_url) {
        if (dynamic_url === '/' + tunnel_id)
            return;
        dynamic_url = undefined;
    }
    React.render(<RequestTunnelView state="waittunnel" tunnel_id={tunnel_id}/>, getRoot());
});

page('/', function (context) {
    if (checkForUnsupportedBrowser())
        return;
    React.render(<RequestTunnelView state="waittunnel" tunnel_id=""/>, getRoot());
});

function redir(url) {
    if (url.length < 2 || url[0] != '/') {
        console.log('error: invalid url: ' + url);
        return;
    }
    if (dynamic_url)
        console.log('warning: dynamic_url is set');
    dynamic_url = url;
    page.show(url);
}

function setupReconnect(tunnel_id) {
    ee.removeEvent('!disconnect');
    ee.addListener('!disconnect', function () {
        core.closeTunnel(tunnel_id);
        // Need random timeout to reduce the pressure onto the server
        var t = 4 + Math.floor(Math.random() * 6);
        React.render(<ReconnectView timeout={t} tunnel_id={tunnel_id}/>, getRoot());
    });
}

page.start();

})();
