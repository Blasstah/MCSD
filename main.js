/* Server Data Context */
class ServerDataContext {
    constructor() {
        this.app = app;
        this.io = io;
        
        this.currentServer = function() {
            return currentServer;
        }
        
        this.properties = function() {
            return new MCServerProperties();
        }

        this.relativePath = (file) => {
            return path.join(__dirname, file)
        }

        this.saveConfig = (name, data) => {
            let json = JSON.stringify(data, null, 4);
            fs.writeFileSync(`config/${name}.json`, json)

            return true;
        }

        this.readConfig = (name, def) => {
            if(!fs.existsSync(`config/${name}.json`)) {
                return def;
            }

            try {
                let json = fs.readFileSync(`config/${name}.json`, "utf-8");
                let obj = JSON.parse(json);

                return obj;
            }catch {
                return def;
            }
        }

        this.toggleServer = toggleServer;

        this.showNotif = ShowNotif;
        this.addEntryPoint = addEntryPoint;
        this.addMenuTab = addMenuTab;
        this.dir = __dirname;
    }
}

/* Libraries */
const path = require("path");
const fs = require("fs")
const pidusage = require("pidusage");
const Gamedig = require('gamedig');

const properties = require("properties-parser");

const express = require('express');
const app = express();
const bodyParser = require("body-parser")

const http = require('http');
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server);

const session = require('express-session')

const sessionMiddleware = session({
    secret: "changeit",
    resave: true,
    saveUninitialized: true,
});

const spawn = require("child_process").spawn;

var AnsiConvert = require('ansi-to-html');
var ansiConvert = new AnsiConvert();

/* Registration */

if(!fs.existsSync(path.join(__dirname, "config")))
    fs.mkdirSync("config")

let global_settings = { password: "admin", Xms: 512, Xmx: 2048, webPort: 3000 };
if(fs.existsSync(path.join(__dirname, "settings.json"))) 
    global_settings = JSON.parse(fs.readFileSync(path.join(__dirname, "settings.json")))

function saveSettings() {
    fs.writeFileSync("settings.json", JSON.stringify(global_settings, null, 4))
}

app.use(sessionMiddleware)
io.engine.use(sessionMiddleware)

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(express.static("client"))
app.use(express.static("node_modules/socket.io/client-dist"))
app.use(express.static("node_modules/bootstrap/dist"))
app.use(express.static("node_modules/jquery/dist"))
app.use(express.static("node_modules/chart.js/dist"))
app.use(express.static("node_modules/dompurify/dist"))

app.set('view engine', 'ejs');

/* Requests */

function generateDashboardData() {
    var properties = new MCServerProperties();
    return {
        running: currentServer != null,
        module_tabs: MODULE_TABS ? MODULE_TABS : [],
        data: {
            motd: ansiConvert.toHtml(properties.data.motd),
            query_enabled: properties.data["enable-query"] == "true",
        }
    };
}

app.post('/login', function(req, res) {
    if(req.body.pass == global_settings.password) {
        req.session.logged = true;
    }

    res.redirect("/");
});

app.get('/', function(req, res) {
    if(req.session.logged) {
        if(fs.existsSync(path.join(__dirname, "mc_server/server.jar")))
            res.render("index", generateDashboardData());
        else res.render("setup")

        return;
    }

    res.render('login');
});

app.get('/settings', function(req, res) {
    if(req.session.logged) {
        if(fs.existsSync(path.join(__dirname, "mc_server/server.jar"))) {
            var data = generateDashboardData();
            var props = new MCServerProperties();
            data.raw = props.raw;
            data.data = props.data;
            data.Xmx = global_settings.Xmx;
            data.Xms = global_settings.Xms;
            res.render("settings", data);
        }
        else res.render("setup")

        return;
    }

    res.render('login');
});

function addEntryPoint(entry, callback) {
    app.get(entry, function(req, res) {
        if(req.session.logged) {
            if(fs.existsSync(path.join(__dirname, "mc_server/server.jar"))) {
                var data = generateDashboardData();
                callback(req, res, data)
            }
            else res.render("setup")
    
            return;
        }
    
        res.render('login');
    });
}

/* Modules */
let MODULE_TABS = [

]
function addMenuTab(bsIcon, title, href, priority) {
    if(priority == null)
        priority = MODULE_TABS.length;

    MODULE_TABS.push({
        icon: bsIcon,
        title,
        href,
        priority,
    })

    MODULE_TABS.sort((a, b) => {
        return a.priority - b.priority;
    })
}

const MODULES = [
    require("./modules/addons")(new ServerDataContext()), // Plugins / Addons
    require("./modules/macros")(new ServerDataContext()), // Command Macros
    require("./modules/scheduler")(new ServerDataContext()), // Scheduler
]
/*
let detectedModules = fs.existsSync("modules") ? fs.readdirSync("modules") : [];
detectedModules.forEach(module => { // Automatically detect modules and require them
    if(!module.endsWith(".js")) return;
    module = module.substring(0, module.length-3)

    MODULES.push(require("./modules/"+module)(new ServerDataContext()));
});
*/
/* End of Modules */

/* Socket */
let loggedSockets = [];
function initialSetupRegister(socket) {
    socket.on("step_proceed", (args) => {
        switch(args.step) {
            case 1:
                if(fs.existsSync(path.join(__dirname, "mc_server/server.jar"))) {
                    socket.emit("step_status", {next: 2});
                }else socket.emit("step_status", {error: "server.jar does not exist!"});
                break;
            case 2:
                fs.writeFileSync(path.join(__dirname, "mc_server/eula.txt"), "#By changing the setting below to TRUE you are indicating your agreement to our EULA (20:53 04.12.202321:00 04.12.2023).\neula=true");

                if(fs.existsSync(path.join(__dirname, "mc_server/server.properties")))
                    socket.emit("step_status", {next: 4});
                else {
                    socket.emit("step_status", {next: 3});
                    currentServer = new MCServer(512, 2048, () => {
                        socket.emit("step_status", {next: 4});
                    });
                    currentServer.close();
                }
                break;
            case 3:
                break;
            case 4:
                var properties = new MCServerProperties();
                properties.editor.set("view-distance", args.data.viewDistance)
                properties.editor.set("simulation-distance", args.data.simDistance)
                properties.editor.set("difficulty", args.data.difficulty)
                properties.editor.set("motd", "An MCSM-made server!")
                properties.editor.save();

                global_settings.Xms = args.data.Xms
                global_settings.Xmx = args.data.Xmx
                saveSettings();

                if(fs.existsSync("mc_server/world"))
                    fs.rmSync("mc_server/world", {recursive: true, force: true})

                if(fs.existsSync("mc_server/world_nether"))
                    fs.rmSync("mc_server/world_nether", {recursive: true, force: true})

                if(fs.existsSync("mc_server/world_the_end"))
                    fs.rmSync("mc_server/world_the_end", {recursive: true, force: true})

                socket.emit("step_status", {redirect: true});
                break;
        }
    })
}

function registerSecureSocket(socket) {
    if(!socket.request.session.logged) return;

    /* INITIAL SETUP */

    if(!fs.existsSync(path.join(__dirname, "mc_server/server.jar")) || !fs.existsSync(path.join(__dirname, "mc_server/server.properties"))) {
        initialSetupRegister(socket);
        return;
    }

    /* INITIAL SETUP END */

    socket.on("command", (cmd) => {
        if(typeof cmd != "string") return;
        if(!currentServer) {
            ShowNotif(socket, "Server is not running, so you can't interact with it.")
            return;
        }

        currentServer.sendCommand(cmd);
    })

    MODULES.forEach(module => {
        if(module.registerSecureSocket)
            module.registerSecureSocket(socket);
    });

    socket.on("properties_replace", (props) => {
        if(typeof props != "string") return;

        new MCServerProperties().replace(props);
        
        ShowNotif(socket, "Successfully updated server.properties!", "success");
    })

    socket.on("enable_query", () => {
        var props = new MCServerProperties();
        props.editor.set("enable-query", "true")
        props.editor.save();
        
        socket.emit("force_reload")
    })

    socket.on("change_admin_pass", (pass) => {
        global_settings.password = pass;
        saveSettings();

        socket.emit("force_reload")
        ShowNotif(socket, "Admin password changed!", "success")
    })

    socket.on("set_memory", (obj) => {
        if(!obj.Xmx) return;
        if(!obj.Xms) return;
        
        if(typeof(obj.Xmx) != "number") return;
        if(typeof(obj.Xms) != "number") return;

        global_settings.Xms = obj.Xms;
        global_settings.Xmx = obj.Xmx;
        saveSettings();

        ShowNotif(socket, "Memory settings changed!", "success")
    })

    socket.on("toggle_server", () => {
        if(!currentServer) {
            ShowNotif(socket, "Server started!", "success")
        }

        toggleServer(socket);
    })

    socket.on("logout", () => {
        socket.request.session.destroy();
        loggedSockets.splice(loggedSockets.indexOf(socket), 1);

        socket.emit("force_reload")
    })

    if(fs.existsSync(path.join(__dirname, "mc_server/logs/latest.log"))) {
        let latestLog = fs.readFileSync(path.join(__dirname, "mc_server/logs/latest.log"), { encoding: 'utf8', flag: 'r' }).replaceAll("\n", "<br>");

        latestLog = `<span class="text-muted">${latestLog}------------------ LATEST LOG ------------------</span>`
        PrintToConsole(latestLog)
    }
}

io.on("connection", (socket) => {
    if(socket.request.session.logged) {
        loggedSockets.push(socket);
        registerSecureSocket(socket);
    }
})

function SecureEmit(ev, args) {
    for(let socket of loggedSockets) {
        if(!socket) continue;
        if(!socket.connected) continue;

        socket.emit(ev, args);
    }
}

function PrintToConsole(str) {
    SecureEmit("console", str);
}

function ShowNotif(socket, message, type) {
    socket.emit("notification", {message, type})
}

/* Minecraft Server */
let currentServer = null;

class MCServerProperties {
    constructor() {
        this.path = "mc_server/server.properties";
        if(!fs.existsSync(this.path)) return;

        this.raw = fs.readFileSync("mc_server/server.properties", "utf-8")
        this.data = properties.parse(this.raw)
        this.editor = properties.createEditor(this.path)

        this.replace = function(text) {
            fs.writeFileSync(this.path, text)
        };
    }
}

class MCServer {
    constructor(Xms, Xmx, closeCallback) {
        if(currentServer != null) {
            return;
        }

        this.closeCallback = closeCallback;
        this.outputCallbacks = []

        this.initialized = false;
        this.stopping = false;

        Xms = Math.max(Xms, 1024);

        Xmx = Math.max(Xms, Xmx);
        Xmx = Math.min(Xmx, 12288);

        this.process = spawn("java", [`-Xms${Xms}M`, `-Xmx${Xmx}M`, "-jar", "server.jar", "nogui"], { cwd: path.join(__dirname, "mc_server") });
        
        this.data = {};
        this.data.players = [];
        
        this.process.stdout.setEncoding("utf8");

        let server = this;
        this.process.stdout.on("data", function (data) 
        {  
            let ansi = ansiConvert.toHtml(data);
            ansi.replaceAll("\n", "<br>")
        
            PrintToConsole(ansi);

            server.outputCallbacks.forEach(callback => {
                if(callback != null || typeof(callback) != "function") {
                    server.outputCallbacks.splice(server.outputCallbacks.indexOf(callback), 1);
                    return;
                }

                let res = callback(data);
                if(res) {
                    server.outputCallbacks.splice(server.outputCallbacks.indexOf(callback), 1);
                    return;
                }
            });
        })

        this.process.on("exit", () => {
            currentServer = null;
            if(this.closeCallback) this.closeCallback();
        })

        this.close = (stopCallback) => {
            this.sendCommand("stop");
            if(stopCallback) this.closeCallback = stopCallback;
            this.stopping = true;
        }

        this.restart = (socket) => {
            if(socket)
                ShowNotif(socket, "Restarting server...");

            this.close(() => {
                toggleServer();

                if(socket) 
                    ShowNotif(socket, "Server restarted!", "success");
            });
        }

        this.addOutputCallback = (callback) => {
            if(callback == null) return;
            if(typeof(callback) != "function") return;

            this.outputCallbacks.push(callback)
        }

        this.sendCommand = (cmd) => {
            this.process.stdin.write(cmd+"\n");
        }

        this.serverMessage = (msg) => {
            let cmd = `tellraw @a ["",{"text":"[MCSM] ","bold":true,"color":"yellow"},{"text":"${msg}","color":"yellow"}]`
            this.sendCommand(cmd);
        }

        this.getPerformance = (callback) => {
            let performance = {}

            pidusage(this.process.pid, (err, stats) => {
                if(err) {
                    performance.memory = 0;
                    performance.memoryPercentage = 0;
                    performance.cpu = 0;
        
                    callback(performance);
                    return;
                }
        
                performance.memory = Math.round(stats.memory / 1024 / 1024);
                performance.memoryPercentage = Math.round(((stats.memory / 1024 / 1024)/global_settings.Xmx)*100);
                performance.cpu = stats.cpu;

                callback(performance);
            })
        }

        this.initialized = true;
    }
}

function statusUpdate(cb) {
    if(currentServer == null) {
        let performance = {}

        performance.memory = 0;
        performance.memoryPercentage = 0;
        performance.cpu = 0;
        cb(performance)
        return;
    }

    currentServer.getPerformance((perf) => {
        cb(perf);
    })
}

function statusTimeout() {
    statusUpdate((perf) => {
        if(!global_settings.statusDelay) 
            global_settings.statusDelay = 1000;

        setTimeout(statusTimeout, global_settings.statusDelay)

        let serverInfo = {};
        serverInfo.performance = perf;
        serverInfo.running = currentServer != null;
        serverInfo.stopping = currentServer ? currentServer.stopping : false

        Gamedig.query({
            type: "minecraft",
            host: "localhost"
        }).then((state) => {
            serverInfo.query = {}
            serverInfo.query.players = [];
            serverInfo.query.maxPlayers = state.maxplayers;
            serverInfo.query.name = state.name;

            for(let el of state.players) {
                serverInfo.query.players.push(el.name);
            }

            SecureEmit("status_update", serverInfo);
        }).catch((err) => {
            SecureEmit("status_update", serverInfo);
        })
    });
}
statusTimeout();

function toggleServer(socket) {
    if(currentServer) {
        currentServer.close(function() {
            if(socket) ShowNotif(socket, "Server stopped!", "success");
        });
        return;
    }

    if(!fs.existsSync(__dirname, "mc_server/server.jar")) return;

    currentServer = new MCServer(global_settings.Xms, global_settings.Xmx);
}

/* Run HTTP Server */
let port = global_settings.webPort ? global_settings.webPort : 3000;
server.listen(port, () => {
    if(global_settings.webPort)

    console.log(`listening on *:${port}`);
});