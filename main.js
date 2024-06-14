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

let global_settings = { password: "admin", Xms: 512, Xmx: 2048 };

function saveSettings() {
    fs.writeFileSync("settings.json", JSON.stringify(global_settings, null, 4))
}

let macros = []

function saveMacros() {
    fs.writeFileSync("macros.json", JSON.stringify(macros, null, 4))
}

if(fs.existsSync(path.join(__dirname, "settings.json"))) global_settings = JSON.parse(fs.readFileSync(path.join(__dirname, "settings.json")))
    if(fs.existsSync(path.join(__dirname, "macros.json"))) macros = JSON.parse(fs.readFileSync(path.join(__dirname, "macros.json")))

/* Requests */

function generateDashboardData() {
    var properties = new MCServerProperties();
    return {
        running: currentServer != null,
        data: {
            motd: ansiConvert.toHtml(properties.data.motd),
            query_enabled: properties.data["enable-query"] == "true",
        }
    };
}

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
            res.render("settings", data);
        }
        else res.render("setup")

        return;
    }

    res.render('login');
});

app.get('/macros', function(req, res) {
    if(req.session.logged) {
        if(fs.existsSync(path.join(__dirname, "mc_server/server.jar"))) {
            var data = generateDashboardData();
            data.macros = macros;
            res.render("macros", data);
        }
        else res.render("setup")

        return;
    }

    res.render('login');
});

app.post('/login', function(req, res) {
    if(req.body.pass == global_settings.password) {
        req.session.logged = true;
    }

    res.redirect("/");
});

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
            PrintToConsole(`<span class="text-muted">Server is not running. You first need to run it using the button in top right corner.</span>`);
            return;
        }

        currentServer.sendCommand(cmd);
    })

    socket.on("macro_apply", (index) => {
        if(typeof index != "number") return;
        if(!currentServer) {
            return;
        }

        if(macros.length <= index) return;

        currentServer.doMacro(macros[index]);
    })

    socket.on("macro_revert", (index) => {
        if(typeof index != "number") return;
        if(!currentServer) {
            return;
        }

        if(macros.length <= index) return;

        currentServer.revertMacro(macros[index]);
    })

    socket.on("macro_remove", (index) => {
        if(typeof index != "number") return;
        if(macros.length <= index) return;

        macros.splice(index, 1)
        saveMacros();
        
        socket.emit("force_reload")
    })

    socket.on("macro_code", (index) => {
        if(index >= macros.length) {
            return;
        }

        let json = JSON.stringify(macros[index]);
        let base64 = btoa(json);

        socket.emit("macro_code", {code: base64, index})
    })

    socket.on("add_macro_code", (code) => {
        if(typeof code != "string") return;

        try {
            let json = atob(code)
            let macro = JSON.parse(json);
            if(macro == null) return;

            if(macro.apply == null) return;
            if(macro.revert == null) return
            if(macro.name == null) return;
            if(macro.desc == null) return;
            if(macro.author == null) return;

            let obfMacro = {
                name: macro.name,
                author: macro.author,
                desc: macro.desc,
                apply: macro.apply,
                revert: macro.revert,
            }

            macros.push(obfMacro);
            saveMacros();

            socket.emit("force_reload")
        }catch {
            // Error
        }
    })

    socket.on("create_macro", (data) => {
        if(data.apply == null) return;
        if(data.revert == null) return
        if(data.name == null) return;
        if(data.desc == null) return;
        if(data.author == null) return;

        let obfMacro = {
            name: data.name,
            author: data.author,
            desc: data.desc,
            apply: data.apply,
            revert: data.revert,
        }

        macros.push(obfMacro);
        saveMacros();

        socket.emit("force_reload")
    })

    socket.on("properties_replace", (props) => {
        if(typeof props != "string") return;

        new MCServerProperties().replace(props);
        
        socket.emit("force_reload")
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
    })

    socket.on("toggle_server", () => {
        toggleServer();
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

        this.initialized = false;

        Xms = Math.max(Xms, 1024);

        Xmx = Math.max(Xms, Xmx);
        Xmx = Math.min(Xmx, 12288);

        this.process = spawn("java", [`-Xms${Xms}M`, `-Xmx${Xmx}M`, "-jar", "server.jar", "nogui"], { cwd: path.join(__dirname, "mc_server") });
        
        this.data = {};
        this.data.players = [];
        
        this.process.stdout.setEncoding("utf8");
        this.process.stdout.on("data", function (data) 
        {  
            let ansi = ansiConvert.toHtml(data);
            ansi.replaceAll("\n", "<br>")
        
            PrintToConsole(ansi);
        })

        this.process.on("exit", () => {
            if(this.closeCallback) this.closeCallback();

            currentServer = null;
        })

        this.close = () => {
            this.sendCommand("stop");
        }

        this.sendCommand = (cmd) => {
            this.process.stdin.write(cmd+"\n");
        }

        this.doMacro = (macro) => {
            if(macro.apply == null) return;

            let index = 0;
            
            currentServer.serverMessage(`Applying \\\"${macro.name}\\\" macro...`)
            for(let cmd of macro.apply) {
                if(index == 0)
                    this.sendCommand(cmd);
                else {
                    setTimeout(() => {
                        this.sendCommand(cmd);
                    }, index*50);
                }

                index++;
            }
        }

        this.revertMacro = (macro) => {
            if(macro.revert == null) return;

            currentServer.serverMessage(`Reverting \\\"${macro.name}\\\" macro...`)
            let index = 0;
            for(let cmd of macro.revert) {
                if(index == 0)
                    this.sendCommand(cmd);
                else {
                    setTimeout(() => {
                        this.sendCommand(cmd);
                    }, index*50);
                }

                index++;
            }
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
                performance.memoryPercentage = Math.round(((stats.memory / 1024 / 1024)/2048)*100);
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
        setTimeout(statusTimeout, 2000)

        let serverInfo = {};
        serverInfo.performance = perf;
        serverInfo.running = currentServer != null;

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

function toggleServer() {
    if(currentServer) {
        currentServer.close();
        return;
    }

    if(!fs.existsSync(__dirname, "mc_server/server.jar")) return;

    currentServer = new MCServer(global_settings.Xms, global_settings.Xmx);
}

/* Run HTTP Server */

server.listen(3000, () => {
    console.log('listening on *:3000');
});