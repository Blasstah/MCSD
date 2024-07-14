const ftpd = require("ftpd");

class FTPServerModule {
    constructor(context) {
        this.context = context;

        context.addMenuTab("hdd-stack", "FTP Server", "/ftpserver", 4)

        const def = {
            enabled: false,
            host: "localhost",
            port: 3001,
            pasv_start: 3002,
            pasv_end: 3050,
            username: "admin",
            password: "123321#"
        }

        this.connections = []

        this.settings = context.readConfig("ftpserver", def);
        context.saveConfig("ftpserver", this.settings);

        this.refreshConnections = () => {
            for(let el of [ ...this.connections ])
                if(!el.socket) this.connections.splice(this.connections.indexOf(el), 1);
        }

        this.initializeServer = () => {
            if(!this.settings.enabled) return;

            if(this.server) this.server.close();

            this.server = null;

            this.server = new ftpd.FtpServer(this.settings.host, {
                getInitialCwd: function() {
                    return "/"
                },
                getRoot: function() {
                    return context.relativePath("mc_server")
                },
                pasvPortRangeStart: this.settings.pasv_start,
                pasvPortRangeEnd: this.settings.pasv_end,
                tlsOptions: this.settings.tls,
            })
    
            this.server.on("error", (err) => {
                console.log(err);
            })
    
            this.server.on("client:connected", (conn) => {
                var username = null;
                this.connections.push(conn);

                /*
                let tickConnId = setInterval(() => {
                    if(!conn.socket || !conn.server) {
                        this.connections.splice(this.connections.indexOf(conn), 1);
                        clearInterval(tickConnId);
                    }
                }, 1000)
                */

                conn.on('command:user', (user, success, failure) => {
                    if(user != this.settings.username) {
                        failure();
                        return;
                    }
    
                    username = user;
                    success();
                });
    
                conn.on("command:pass", (pass, success, failure) => {
                    if(pass != this.settings.password) {
                        failure();
                        return;
                    }
    
                    success(username);
                });

                this.refreshConnections()
            })

            this.server.debugging = 4;
            if(this.settings.enabled)
                this.server.listen(this.settings.port);
        }
        this.initializeServer();

        this.registerSecureSocket = (socket) => {
            socket.on("ftp_settings_update", (payload) => {
                this.settings.enabled = payload.enabled ? true : false;
                this.settings.host = payload.host;

                if(!isNaN(payload.port))
                    this.settings.port = payload.port;
                else socket.emit("force_reload", {message: "Couldn't update FTP settings!", type: "error"})

                if(!isNaN(payload.pasv_start))
                    this.settings.pasv_start = payload.pasv_start;
                else socket.emit("force_reload", {message: "Couldn't update FTP settings!", type: "error"})

                if(!isNaN(payload.pasv_end))
                    this.settings.pasv_end = payload.pasv_end;
                else socket.emit("force_reload", {message: "Couldn't update FTP settings!", type: "error"})

                context.saveConfig("ftpserver", this.settings);
                this.context.showNotif(socket, "Updated FTP settings!", "success")
            });

            socket.on("ftp_credentials", (payload) => {
                let username = payload.username;
                let password = payload.password;

                if(typeof(username) != "string") {
                    socket.emit("force_reload", {message: "Bad username!", type: "error"})
                    return;
                }

                if(typeof(password) != "string") {
                    socket.emit("force_reload", {message: "Bad password!", type: "error"})
                    return;
                }

                if(username.length < 5) {
                    socket.emit("force_reload", {message: "Username requires at least 5 characters!", type: "error"})
                    return;
                }

                if(password.length < 5) {
                    socket.emit("force_reload", {message: "Password requires at least 5 characters!", type: "error"})
                    return;
                }

                this.settings.username = username;
                this.settings.password = password;
                context.saveConfig("ftpserver", this.settings);

                socket.emit("force_reload", {message: "Successfully updated FTP credentials!", type: "success"})
            })
        }

        this.context.addEntryPoint("/ftpserver", (req, res, data) => {
            data.ftp_server = { ...this.settings };
            delete data.ftp_server.password

            this.refreshConnections()
            data.connections = []
            for(let el of this.connections) {
                if(!el.socket) continue;
                console.log(el)
                data.connections.push(el.socket.remoteAddress);
            }

            res.render("ftpserver", data)
        })
    }
}

module.exports = function(context) {
    return new FTPServerModule(context);
}