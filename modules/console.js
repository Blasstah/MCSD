const readline = require("readline");
const colors = require("colors/safe");

class ConsoleModule {
    constructor(context) {
        this.context = context;
        this.commands = {};

        this.serverMode = 0;

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })

        this.log = this.context.log;

        this.clear = () => {
            process.stdout.write('\x1Bc')
        }

        this.commandHandler = () => {
            this.rl.question(this.serverMode == 0 ? colors.green("MCSD> ") : "", (raw) => {
                if(this.serverMode == 1 && !raw.startsWith(':')) {
                    if(this.context.currentServer())
                        this.context.currentServer().sendCommand(raw);
                    else
                        console.log(colors.red("Server needs to be running in order to run commands!"))
                    this.commandHandler();
                    return;
                }

                if(raw.startsWith(':')) raw = raw.substring(1, raw.length);

                let cmdData = raw.split(' ');

                let cmd = cmdData.splice(0, 1);

                if(typeof(this.commands[cmd]) == "object" && typeof(this.commands[cmd].func) == "function") {
                    this.commands[cmd].func(cmdData);
                }

                this.commandHandler();
            })
        }

        this.addCommand = (alias, func, description, help) => {
            if(!description) description = colors.gray("[Empty]");
            if(!help) help = colors.gray("[No help available]")

            if(alias == "" || alias == null) return false;
            if(typeof(func) != "function") return false;

            if(this.commands[alias] != null) {
                return false;
            }

            this.commands[alias] = {
                func,
                description,
                help,
            };
            return true;
        }

        this.removeCommand = (alias) => {
            delete this.commands[alias];
        }

        this.onLog = (msg) => {
            if(this.serverMode > 0) return;

            console.log(msg);
        }

        this.outputId = 0;
        this.switchMode = (mode) => {
            switch(mode) {
                case 0:
                    this.serverMode = 0;
                    this.clear();
                    this.context.getLogs().forEach(el => {
                        console.log(el)
                    });
                    break;
                case 1:
                    if(!this.context.currentServer()) {
                        this.context.log(colors.red("Server needs to be running in order to see it!"))
                        return;
                    }

                    this.serverMode = 1;
                    this.clear();

                    let myId = this.outputId + 1;
                    this.outputId = myId;
                    this.context.currentServer().addOutputCallback((msg) => {
                        if(this.outputId != myId || this.serverMode < 1)
                            return true;

                        console.log(msg);
                        return false;
                    })

                    console.log(colors.gray(this.context.getLatestLog()+"---------------------------- LATEST LOG ----------------------------"))
                    console.log(`${colors.yellow("You're now in MC Server View. Type")} ${colors.green(":back")} ${colors.yellow("to go back to MCSD CMD.")} `)
                    break;
            }
        }

        /* Default Commands */
        this.registerDefaults = () => {
            this.addCommand("stop", (args) => {
                if(this.context.currentServer()) {
                    this.log(colors.yellow("Turning of the app... (Waiting for server to close)"));
                    this.context.currentServer().close(() => {
                        this.log(colors.yellow("MC Server turned off. Exiting..."));
                        process.exit();
                    })
                    return;
                }

                this.log(colors.yellow("Exiting..."));
                process.exit(0);
            }, "Exits MCSD and safely turns off the server if it's running.");
            this.addCommand("clear", (args) => {
                this.clear();
            }, "Clears up the MCSD screen")
            this.addCommand("help", (args) => {
                if(args.length > 0) {
                    let cmd = args[0];

                    if(this.commands[cmd] == null) {
                        this.log(colors.red(`Command "${cmd}" not found!`))
                        return;
                    }

                    this.log(` - ${colors.yellow(cmd)}: ${this.commands[cmd].description}`);
                    this.log(`${this.commands[cmd].help}`);
                    return;
                }

                this.log(colors.yellow("Command List:"))
                Object.keys(this.commands).forEach(key => {
                    let obj = this.commands[key];

                    this.log(` - ${colors.yellow(key)}: ${obj.description}`);
                });
            }, "Displays help about certain command, or command list, if no argument is passed.")

            this.addCommand("ping", (args) => {
                this.context.log("Pong!");
            }, "Pongs back to you :)")

            this.addCommand("mc", (args) => {
                switch(args[0]) {
                    case "toggle":
                        this.context.toggleServer()
                        if(args[1] && args[1] == 'v')
                            this.switchMode(1);
                        break;
                    case "restart":
                        if(this.context.currentServer())
                            this.context.currentServer().restart();
                        else
                            this.context.log(colors.red("Server needs to be running in order to restart it!"));
                        break;
                    case "view":
                        this.switchMode(1);
                        break;
                    case "usage":
                        if(!this.context.currentServer()) {
                            this.log(colors.red("Server needs to be running in order to check it's usage!"));
                            return;
                        }
                        this.log(colors.yellow("Checking server usage..."))
                        this.context.currentServer().getPerformance((perf) => {
                            this.log(colors.green("MC Server usage: "))
                            this.log(colors.red(` - RAM: ${perf.memoryPercentage}%`))
                            this.log(colors.blue(` - CPU: ${perf.cpu}%`))
                        })
                        break;
                    default:
                        this.context.log(colors.red("You need to provide valid action argument. See help page for mc command."));
                        break;
                }
            }, "Used to control various aspects of Minecraft Server.", "Various arguments give different results like:\n - toggle: toggles server on/off.\n - restart: restarts server\n - view: shows minecraft server console")
    
            this.addCommand("back", (_) => {
                if(this.serverMode < 1) return;
                this.switchMode(0)
            }, "Reverts console from MC Server to MCSD console.")
        }
        this.registerDefaults();

        /* Run */
        this.clear();
        this.context.onLog(this.onLog);
        this.commandHandler();
    }
}

module.exports = function(context) {
    return new ConsoleModule(context);
}