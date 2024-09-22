const ftpd = require("ftpd");
const fs = require("fs");
const crypto = require("crypto");
const colors = require("colors");

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
            password: "jGl25bVBBBW96Qi9Te4V37Fnqchz/Eu4qB9vKrRIqRg=",
            ip_whitelist: [
                "::1",
                "localhost",
                "127.0.0.1"
            ]
        }

        this.connections = []

        this.settings = context.readConfig("ftpserver", def);
        context.saveConfig("ftpserver", this.settings);

        const PASS_ELEMENTS = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890!@#$%^&*";
        if(context.launchArgs.length > 0 && context.launchArgs[0] == "ftp") {
            this.context.log(colors.yellow("--- FTP LAUNCH DETECTED ---"))
            this.settings.enabled = true;
            this.context.log("FTP Server ran on port: "+colors.green(this.settings.port));
            this.context.log("FTP username: "+colors.green(this.settings.username))
            if(this.settings.password == "jGl25bVBBBW96Qi9Te4V37Fnqchz/Eu4qB9vKrRIqRg=") {
                let pass = "";
                for(let i = 0; i < 8; i++) {
                    let rand = crypto.randomInt(PASS_ELEMENTS.length);
                    pass += PASS_ELEMENTS[rand];

                    let hash = crypto.createHash("sha256");
                    let data = hash.update(pass).digest("base64").toString();

                    this.settings.password = data;
                }

                this.context.log("--- Since password is set to default (admin), new FTP password will be generated.");
                this.context.log("Generated FTP password: "+colors.green(pass))
            }
            this.context.log(colors.yellow("---------------------------"))
        }

        this.refreshConnections = () => {
            for(let el of [ ...this.connections ])
                if(!el.socket) this.connections.splice(this.connections.indexOf(el), 1);
        }

        this.initializeServer = () => {
            if(!this.settings.enabled) return;

            if(this.server) this.server.close();

            this.server = null;

            let ftpSettings = {
                getInitialCwd: function() {
                    return "/"
                },
                getRoot: function() {
                    return context.relativePath("mc_server")
                },
                pasvPortRangeStart: this.settings.pasv_start,
                pasvPortRangeEnd: this.settings.pasv_end,
                tlsOptions: null,
            }

            this.server = new ftpd.FtpServer(this.settings.host, ftpSettings)
    
            this.server.on("error", (err) => {
                this.context.log(err);
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
                    if(!this.settings.ip_whitelist.includes(conn.socket.remoteAddress)) {

                        failure();
                        return;
                    }

                    if(user != this.settings.username) {
                        failure();
                        return;
                    }
    
                    username = user;
                    success();
                });
    
                conn.on("command:pass", (pass, success, failure) => {
                    if(!this.settings.ip_whitelist.includes(conn.socket.remoteAddress)) {
                        failure();
                        return;
                    }

                    let hash = crypto.createHash("sha256");
                    let data = hash.update(pass)
                    data = hash.digest("base64").toString();

                    if(data != this.settings.password) {
                        failure();
                        return;
                    }
    
                    success(username);
                });

                this.refreshConnections()
            })

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

                let hash = crypto.createHash("sha256");
                let data = hash.update(password);
                data = hash.digest("base64").toString();
                
                this.settings.password = data;
                context.saveConfig("ftpserver", this.settings);

                socket.emit("force_reload", {message: "Successfully updated FTP credentials!", type: "success"})
            })

            socket.on("ftp_whitelist_add", (payload) => {
                let ipAddr = payload.ip;

                if(ipAddr == null || typeof(ipAddr) != "string" || ipAddr == "") {
                    this.context.showNotif(socket, "Invalid IP Address!", "error");
                    return;
                }

                let index = this.settings.ip_whitelist.indexOf(ipAddr);
                if(index > -1) {
                    this.context.showNotif(socket, "Provided IP is already whitelisted!", "error");
                    return;
                }

                this.settings.ip_whitelist.push(ipAddr);
                socket.emit("force_reload", {message: `Successfully added ${ipAddr} to the whitelist!`, type: "success"})
                context.saveConfig("ftpserver", this.settings);
            })

            socket.on("ftp_whitelist_remove", (payload) => {
                let ipAddr = payload.ip;

                if(ipAddr == null || typeof(ipAddr) != "string" || ipAddr == "") {
                    this.context.showNotif(socket, "Invalid IP Address!", "error");
                    return;
                }

                let index = this.settings.ip_whitelist.indexOf(ipAddr);
                if(index < 0) {
                    this.context.showNotif(socket, "Provided IP is not in the whitelist!", "error");
                    return;
                }

                this.settings.ip_whitelist.splice(index, 1);
                socket.emit("force_reload", {message: `Successfully removed ${ipAddr} from the whitelist!`, type: "success"})
                context.saveConfig("ftpserver", this.settings);
            })
        }

        this.context.addEntryPoint("/ftpserver", (req, res, data) => {
            data.ftp_server = { ...this.settings };
            delete data.ftp_server.password

            this.refreshConnections()
            data.connections = []
            for(let el of this.connections) {
                if(!el.socket) continue;
                data.connections.push(el.socket.remoteAddress);
            }

            res.render("ftpserver", data)
        })
    }
}

module.exports = function(context) {
    return new FTPServerModule(context);
}