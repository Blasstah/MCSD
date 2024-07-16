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
            this.rl.question(this.serverMode == 0 ? colors.green("MCSM> ") : colors.yellow("MC> "), (raw) => {
                if(this.serverMode == 1 && !raw.startsWith(':')) {

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
            console.log(msg);
        }

        /* Commands */
        this.addCommand("ping", (args) => {
            this.context.log("Pong!");
        })

        this.addCommand("server", (args) => {
            switch(args[0]) {
                case "toggle":
                    this.context.toggleServer()
                    break;
                case "restart":
                    if(this.context.currentServer())
                        this.context.currentServer().restart();
                    else
                        this.context.log(colors.red("Server needs to be running in order to restart it!"));
                    break;
            }
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