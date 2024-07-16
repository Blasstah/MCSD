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

        this.clear = () => {
            process.stdout.write('\x1Bc')
        }

        this.commandHandler = () => {
            this.rl.question(this.serverMode == 0 ? colors.green("MCSM> ") : "", (raw) => {
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

                if(typeof(this.commands[cmd]) == "function") {
                    this.commands[cmd](cmdData);
                }

                this.commandHandler();
            })
        }

        this.addCommand = (alias, func) => {
            if(alias == "" || alias == null) return false;
            if(typeof(func) != "function") return false;

            if(this.commands[alias] != null) {
                return false;
            }

            this.commands[alias] = func;
            return true;
        }

        this.removeCommand = (alias) => {
            delete this.commands[alias];
        }

        this.onLog = (msg) => {
            if(this.serverMode > 0) return;

            console.log(msg);
        }

        /* Commands */
        this.addCommand("ping", (args) => {
            this.context.log("Pong!");
        })

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
                    break;
            }
        }

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
            }
        })

        this.addCommand("back", (args) => {
            if(this.serverMode < 1) return;
            this.switchMode(0)
        })

        /* Run */
        this.clear();
        this.context.onLog(this.onLog);
        this.commandHandler();
    }
}

module.exports = function(context) {
    return new ConsoleModule(context);
}