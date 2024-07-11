const fs = require("fs");
const path = require("path");
const { escape, unescape } = require("querystring");

class MacrosModule {
    constructor(context) {
        this.context = context;

        const def = [
            {
                name: "Death Counter",
                author: "Blasstah",
                desc: "Adds a death counter to the Player List",
                apply: [
                    "scoreboard objectives add deathCounter deathCount \"Deaths\"",
                    "scoreboard objectives setdisplay list deathCounter"
                ],
                revert: [
                    "scoreboard objectives remove deathCounter"
                ]
            },
            {
                name: "Health Display",
                author: "Blasstah",
                desc: "Displays player's health beneath the nametag.",
                apply: [
                    "scoreboard objectives add healthDisplay health \"§c❤\"",
                    "scoreboard objectives setdisplay below_name healthDisplay"
                ],
                revert: [
                    "scoreboard objectives remove healthDisplay"
                ]
            }
        ]

        this.macros = context.readConfig("macros", def);
        context.saveConfig("macros", this.macros)

        this.doMacro = (macro) => {
            if(macro.apply == null) return;

            let index = 0;
            
            this.context.currentServer().serverMessage(`Applying \\\"${macro.name}\\\" macro...`)
            for(let cmd of macro.apply) {
                if(index == 0)
                    this.context.currentServer().sendCommand(cmd);
                else {
                    setTimeout(() => {
                        this.context.currentServer().sendCommand(cmd);
                    }, index*50);
                }

                index++;
            }
        }

        this.revertMacro = (macro) => {
            if(macro.revert == null) return;

            this.context.currentServer().serverMessage(`Reverting \\\"${macro.name}\\\" macro...`)
            let index = 0;
            for(let cmd of macro.revert) {
                if(index == 0)
                    this.context.currentServer().sendCommand(cmd);
                else {
                    setTimeout(() => {
                        this.context.currentServer().sendCommand(cmd);
                    }, index*50);
                }

                index++;
            }
        }

        this.save = () => {
            this.context.saveConfig("macros", this.macros);
        }
        
        this.registerSecureSocket = (socket) => {
            socket.on("macro_apply", (index) => {
                if(typeof index != "number") return;
                if(!this.context.currentServer()) {
                    this.context.showNotif(socket, "Server needs to be running in order to apply a macro.")
                    return;
                }
        
                if(this.macros.length <= index) return;
        
                this.doMacro(this.macros[index]);
                this.context.showNotif(socket, `Applied "${this.macros[index].name}" macro"!`, "success")
            })
        
            socket.on("macro_revert", (index) => {
                if(typeof index != "number") return;
                if(!this.context.currentServer()) {
                    this.context.showNotif(socket, "Server needs to be running in order to revert a macro.")
                    return;
                }
        
                if(this.macros.length <= index) return;
        
                this.revertMacro(this.macros[index]);
                this.context.showNotif(socket, `Reverted "${this.macros[index].name}" macro"!`, "success")
            })
        
            socket.on("macro_remove", (index) => {
                if(typeof index != "number") return;
                if(this.macros.length <= index) {
                    this.context.showNotif(socket, "Something went wrong. Could not delete this macro!", "error")
                    return;
                }
        
                let name = this.macros[index].name;
                this.macros.splice(index, 1)
                this.save();

                this.context.showNotif(socket, `Successfully removed "${name}"!`, "success")
                
                socket.emit("force_reload")
            })
        
            socket.on("macro_code", (index) => {
                if(index >= this.macros.length) {
                    return;
                }
        
                let json = JSON.stringify(this.macros[index]);
                let base64 = btoa(escape(json));

                this.context.showNotif(socket, `Code for "${this.macros[index].name}" copied to clipboard!`, "success")
        
                socket.emit("macro_code", {code: base64, index})
            })

            socket.on("macro_list", () => {
                let codes = [];

                this.macros.forEach(macro => {
                    let json = JSON.stringify(macro);
                    let base64 = btoa(escape(json));

                    codes.push(base64);
                });

                this.context.showNotif(socket, `Successfully copied JSON for all of your macros! Now you can put it on pastebin!`, "success")
                socket.emit("macro_list", JSON.stringify(codes, null, 4))
            })
        
            socket.on("add_macro_code", (code) => {
                if(typeof code != "string") return;
        
                try {
                    let json = atob(code)
                    let macro = JSON.parse(unescape(json));
                    if(macro == null) {
                        this.context.showNotif(socket, "Provided code is invalid!", "error")
                        return;
                    }
        
                    if(macro.apply == null || macro.revert == null || macro.revert == null || macro.name == null || macro.desc == null || macro.author) {
                        this.context.showNotif(socket, "Provided code is invalid!", "error")
                        return;
                    }
        
                    let obfMacro = {
                        name: macro.name,
                        author: macro.author,
                        desc: macro.desc,
                        apply: macro.apply,
                        revert: macro.revert,
                    }
        
                    this.macros.push(obfMacro);
                    this.save();

                    this.context.showNotif(socket, `Successfully imported "${obfMacro.name}"!`, "success")
        
                    socket.emit("force_reload")
                }catch {
                    // Error
                    this.context.showNotif(socket, "Provided code is invalid!", "error")
                }
            })
        
            socket.on("create_macro", (data) => {
                if(data.apply == null) {
                    this.context.showNotif(socket, "No apply commands provided!", "error")
                    return;
                }
                if(data.revert == null) {
                    this.context.showNotif(socket, "No revert commands provided!", "error")
                    return
                }
                if(data.name == null) {
                    this.context.showNotif(socket, "Name is required!", "error")
                    return;
                }
                if(data.desc == null) {
                    this.context.showNotif(socket, "Description is required!", "error")
                    return;
                }
                if(data.author == null) {
                    this.context.showNotif(socket, "Author name is required!", "error")
                    return;
                }
        
                let obfMacro = {
                    name: data.name,
                    author: data.author,
                    desc: data.desc,
                    apply: data.apply,
                    revert: data.revert,
                }
        
                this.macros.push(obfMacro);
                this.save();

                this.context.showNotif(socket, `Successfully created "${obfMacro.name}"!`, "success")
        
                socket.emit("force_reload")
            })
        }

        context.addMenuTab("terminal", "Command Macros", "/macros", 2)

        context.addEntryPoint("/macros", (req, res, data) => {
            data.macros = this.macros;
            res.render("macros", data)
        })
    }
}

module.exports = function(context) {
    return new MacrosModule(context);
}